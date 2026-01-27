Pod::Spec.new do |s|
  s.name             = 'CashuDevKit'
  s.version          = '0.14.2'
  s.summary          = 'Cashu Development Kit - FFI bindings for iOS'
  s.description      = <<-DESC
    CashuDevKit provides Swift bindings to the Cashu Development Kit (CDK),
    a Rust library for building Cashu wallets. This enables native ecash
    functionality including minting, melting, sending, and receiving tokens.
  DESC

  s.homepage         = 'https://github.com/cashubtc/cdk'
  s.license          = { :type => 'MIT' }
  s.author           = { 'Cashu' => 'dev@cashu.space' }
  s.source           = { :git => 'https://github.com/cashubtc/cdk.git', :tag => s.version.to_s }

  s.ios.deployment_target = '13.0'
  s.swift_version = '5.0'

  # Vendored xcframework
  s.vendored_frameworks = 'Cdk/cdkFFI.xcframework'

  # Source files - Swift bindings
  s.source_files = 'CashuDevKit/CashuDevKit.swift'

  # Framework dependencies
  s.frameworks = 'Foundation', 'Security'

  # Static library settings
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'ENABLE_BITCODE' => 'NO',
    'OTHER_LDFLAGS' => '-ObjC',
    'CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES' => 'YES'
  }

  s.user_target_xcconfig = {
    'ENABLE_BITCODE' => 'NO'
  }

  # Preserve paths for the framework
  s.preserve_paths = 'Cdk/cdkFFI.xcframework/**/*'
end
