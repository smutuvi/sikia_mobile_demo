# Sikia

Sikia is a mobile AI assistant that runs small language models (SLMs) entirely on-device — no internet required, no data leaves your phone. Built for iOS and Android using React Native.

## Features

- **Offline AI**: Chat with SLMs locally — no cloud, no tracking.
- **Model Flexibility**: Download and switch between multiple models (Phi, Gemma, Qwen, Danube, and more).
- **Hugging Face Integration**: Browse and download GGUF models directly from the HF Hub, including gated models with your access token.
- **Auto Memory Management**: Models are offloaded automatically when the app goes to background.
- **Cross-Platform**: Optimized for phones and tablets on both iOS and Android.

<!-- - **Personalized Pals**: Create AI personas with custom system prompts and settings. -->
<!-- - **Performance Benchmarking**: Test model speed and memory usage on your device. -->

## Development Setup

### Prerequisites

- Node.js 18+
- Yarn
- React Native CLI
- Xcode (iOS)
- Android Studio (Android)

### Getting Started

```bash
git clone https://github.com/smutuvi/sikia_mobile_demo.git
cd sikia_mobile_demo
yarn install

# iOS
cd ios && pod install && cd ..
yarn ios

# Android
yarn android
```

### Useful Scripts

```bash
yarn start       # Start Metro bundler
yarn lint        # Lint the codebase
yarn typecheck   # Run TypeScript type checks
yarn test        # Run tests
yarn clean       # Clean build artifacts
```

## License

MIT
