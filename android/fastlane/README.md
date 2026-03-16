fastlane documentation
----

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

## Android

### android distribute

```sh
[bundle exec] fastlane android distribute
```

Build a debug APK and distribute to testers via Firebase App Distribution

### android distribute_release

```sh
[bundle exec] fastlane android distribute_release
```

Build a signed Release APK and distribute to testers via Firebase App Distribution

### android release_android_alpha

```sh
[bundle exec] fastlane android release_android_alpha
```

Release Android app to Alpha track

----

This README.md is auto-generated and will be re-generated every time [_fastlane_](https://fastlane.tools) is run.

More information about _fastlane_ can be found on [fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on [docs.fastlane.tools](https://docs.fastlane.tools).
