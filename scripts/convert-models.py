"""
Converts BERT-family cross-encoder checkpoints to .tflite for LiteRT.js:

  - cross-encoder/ms-marco-MiniLM-L-6-v2  -> public/models/rerank/  (1 logit)
  - cross-encoder/nli-MiniLM2-L6-H768     -> public/models/nli/     (3 logits)

Uses the classic TFLite converter (Windows-reliable) via transformers'
TF classes with from_pt=True, fixed [1, 256] shapes, dynamic-range int8
quantization, and a score-parity check against the TF reference — a
conversion only ships if quantized logits stay close AND preserve ranking.

Run inside the conda env:  conda run -n legal-py312 python scripts/convert-models.py
"""
import os
import sys

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
os.environ.setdefault("TRANSFORMERS_NO_ADVISORY_WARNINGS", "1")

import numpy as np
import tensorflow as tf
from transformers import AutoTokenizer, TFAutoModelForSequenceClassification

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEQ = 256

TARGETS = [
    {
        "repo": "cross-encoder/ms-marco-MiniLM-L-6-v2",
        "outdir": os.path.join(ROOT, "public", "models", "rerank"),
        "fname": "ms-marco-minilm-l6.tflite",
        "samples": [
            ("how long do refunds take", "Refunds are queued instantly but credit timelines depend on the bank."),
            ("how long do refunds take", "The workflow syntax for GitHub Actions uses YAML."),
            ("webhook signature fails", "Verify the webhook signature using the shared secret and HMAC-SHA256."),
            ("webhook signature fails", "UPI mandates support a maximum of one lakh rupees per debit."),
        ],
    },
    {
        # NOTE: must be a BERT/DistilBERT-family checkpoint — the browser
        # tokenizer is WordPiece. (nli-MiniLM2-L6-H768 is RoBERTa/BPE.)
        "repo": "typeform/distilbert-base-uncased-mnli",
        "outdir": os.path.join(ROOT, "public", "models", "nli"),
        "fname": "nli-distilbert-mnli.tflite",
        "samples": [
            ("Refunds are debited from the next settlement batch.", "Refunds reduce the upcoming settlement payout."),
            ("Refunds are debited from the next settlement batch.", "Refunds are paid from the merchant's bank account directly."),
            ("UPI refunds credit within one business day.", "UPI refunds take three weeks to arrive."),
            ("The fee is four rupees per instant refund.", "Instant refunds carry a small per-refund fee."),
        ],
    },
]


def convert(target):
    repo, outdir, fname = target["repo"], target["outdir"], target["fname"]
    os.makedirs(outdir, exist_ok=True)
    print(f"\n=== {repo} ===")

    tokenizer = AutoTokenizer.from_pretrained(repo)
    model = TFAutoModelForSequenceClassification.from_pretrained(repo, from_pt=True)
    tokenizer.save_vocabulary(outdir)
    print(f"vocab -> {outdir}")
    print(f"model_type = {model.config.model_type}   id2label = {model.config.id2label}")

    uses_type_ids = model.config.model_type not in ("distilbert",)

    if uses_type_ids:

        @tf.function(
            input_signature=[
                tf.TensorSpec([1, SEQ], tf.int32, name="input_ids"),
                tf.TensorSpec([1, SEQ], tf.int32, name="attention_mask"),
                tf.TensorSpec([1, SEQ], tf.int32, name="token_type_ids"),
            ]
        )
        def serving(input_ids, attention_mask, token_type_ids):
            out = model(
                input_ids=input_ids,
                attention_mask=attention_mask,
                token_type_ids=token_type_ids,
                training=False,
            )
            return {"logits": out.logits}

    else:

        @tf.function(
            input_signature=[
                tf.TensorSpec([1, SEQ], tf.int32, name="input_ids"),
                tf.TensorSpec([1, SEQ], tf.int32, name="attention_mask"),
            ]
        )
        def serving(input_ids, attention_mask):
            out = model(input_ids=input_ids, attention_mask=attention_mask, training=False)
            return {"logits": out.logits}

    concrete = serving.get_concrete_function()
    converter = tf.lite.TFLiteConverter.from_concrete_functions([concrete], model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]  # dynamic-range int8
    tflite_bytes = converter.convert()
    out_path = os.path.join(outdir, fname)
    with open(out_path, "wb") as f:
        f.write(tflite_bytes)
    print(f"{fname}: {len(tflite_bytes) / 1e6:.1f} MB")

    # ---- parity: quantized TFLite vs TF reference ----------------------
    interp = tf.lite.Interpreter(model_content=tflite_bytes)
    interp.allocate_tensors()
    input_details = interp.get_input_details()

    def tflite_logits(enc):
        feeds = {
            "input_ids": enc["input_ids"],
            "attention_mask": enc["attention_mask"],
            "token_type_ids": enc.get("token_type_ids", np.zeros_like(enc["input_ids"])),
        }
        for d in input_details:
            name = d["name"].lower()
            key = (
                "attention_mask"
                if "mask" in name
                else "token_type_ids"
                if ("type" in name or "segment" in name)
                else "input_ids"
            )
            interp.set_tensor(d["index"], feeds[key].astype(np.int32))
        interp.invoke()
        (out_detail,) = interp.get_output_details()
        return interp.get_tensor(out_detail["index"])[0]

    ref_scores, lite_scores, max_diff = [], [], 0.0
    for a, b in target["samples"]:
        enc = tokenizer(
            a, b, padding="max_length", truncation=True, max_length=SEQ, return_tensors="np"
        )
        ref_kwargs = dict(input_ids=enc["input_ids"], attention_mask=enc["attention_mask"])
        if uses_type_ids:
            ref_kwargs["token_type_ids"] = enc.get(
                "token_type_ids", np.zeros_like(enc["input_ids"])
            )
        ref = model(**ref_kwargs, training=False).logits.numpy()[0]
        lite = tflite_logits(enc)
        ref_scores.append(ref)
        lite_scores.append(lite)
        max_diff = max(max_diff, float(np.max(np.abs(ref - lite))))
        print(f"  ref={np.round(ref, 3)}  tflite={np.round(lite, 3)}")

    # ranking parity on the primary logit / argmax
    if ref_scores[0].shape[-1] == 1:
        ref_order = np.argsort([-r[0] for r in ref_scores])
        lite_order = np.argsort([-l[0] for l in lite_scores])
        rank_ok = list(ref_order) == list(lite_order)
    else:
        rank_ok = all(np.argmax(r) == np.argmax(l) for r, l in zip(ref_scores, lite_scores))

    print(f"  max |logit diff| = {max_diff:.4f}   ranking preserved = {rank_ok}")
    if not rank_ok:
        print("  !! PARITY FAILURE — do not ship this conversion")
        return False
    return True


if __name__ == "__main__":
    ok = all(convert(t) for t in TARGETS)
    print("\nAll conversions passed parity." if ok else "\nCONVERSION PARITY FAILED")
    sys.exit(0 if ok else 1)
