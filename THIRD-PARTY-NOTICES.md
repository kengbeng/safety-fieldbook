# Third-party software

- Hugging Face Transformers.js 3.8.1, Apache License 2.0: see transformers-LICENSE. Bundled browser runtime from the official @huggingface/transformers npm package.
- ONNX Runtime Web 1.22.0-dev.20250409-89f8206ba4, MIT: see onnxruntime-LICENSE. Its matching JSEP loader and WASM binary accompany the runtime.
- Optional model: https://huggingface.co/Xenova/whisper-tiny.en at revision 79fb389fc764e7c395bd330e9531d9d32ada7049. Downloaded only when speech setup/transcription is requested, cached locally, not included in this repository. Model provenance and license information are available on its model card.
