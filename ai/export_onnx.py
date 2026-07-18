# Export model using ONNX
import os
import shutil
import numpy as np
import onnx
import torch

from predict import load_model, SEQUENCE_LENGTH, INPUT_SIZE, CLASSES

ONNX_PATH = os.path.join(os.path.dirname(__file__), "models", "focus_lstm.onnx")
# The browser is the consumer, so drop a copy where Vite serves static assets.
FRONTEND_MODEL_PATH = os.path.join(
    os.path.dirname(__file__), "..", "frontend", "public", "models", "focus_lstm.onnx"
)
OPSET = 18


def main():
    # load_model() loads focus_lstm.pth, sets .eval() (disables dropout — required
    # so the traced graph is the deterministic inference path), and warms up.
    model, device = load_model()

    # A representative input. Values don't matter for the graph shape; we reuse
    # it below to feed both engines identical data for the parity check.
    dummy = torch.randn(1, SEQUENCE_LENGTH, INPUT_SIZE, device=device)

    torch.onnx.export(
        model,
        dummy,
        ONNX_PATH,
        input_names=["landmarks"],
        output_names=["logits"],
        opset_version=OPSET,
        # Fixed shape (1, 30, 1404): the browser runs one window at a time, so no
        # dynamic batch axis is needed. Simpler graph, no exporter constraint warnings.
    )

    # torch may write weights to a sidecar focus_lstm.onnx.data file. Re-save inline
    # so the browser fetches a single self-contained .onnx (one request, no path
    # resolution). load() pulls in any external data; save with external data off.
    onnx.save_model(onnx.load(ONNX_PATH), ONNX_PATH, save_as_external_data=False)
    external_data = ONNX_PATH + ".data"
    if os.path.exists(external_data):
        os.remove(external_data)
    print(f"Wrote {ONNX_PATH}")

    verify_parity(model, dummy)

    # Serve the same file to the frontend (browser-side onnxruntime-web loads it).
    os.makedirs(os.path.dirname(FRONTEND_MODEL_PATH), exist_ok=True)
    shutil.copyfile(ONNX_PATH, FRONTEND_MODEL_PATH)
    print(f"Copied to {FRONTEND_MODEL_PATH}")


def verify_parity(model, dummy):
    """Run the same input through PyTorch and onnxruntime; assert they match.
    This is the step people skip and then chase phantom accuracy bugs."""
    import onnxruntime as ort

    with torch.no_grad():
        torch_logits = model(dummy).cpu().numpy()

    sess = ort.InferenceSession(ONNX_PATH, providers=["CPUExecutionProvider"])
    onnx_logits = sess.run(["logits"], {"landmarks": dummy.cpu().numpy()})[0]

    max_diff = np.abs(torch_logits - onnx_logits).max()
    print(f"max abs logit diff = {max_diff:.2e}")
    assert max_diff < 1e-4, f"Parity FAILED: diff {max_diff} too large"

    # Also confirm the human-facing answer (argmax) agrees.
    t_pred = CLASSES[int(torch_logits.argmax())]
    o_pred = CLASSES[int(onnx_logits.argmax())]
    assert t_pred == o_pred, f"Prediction mismatch: {t_pred} vs {o_pred}"
    print(f"parity OK — both predict '{o_pred}'")


if __name__ == "__main__":
    main()
