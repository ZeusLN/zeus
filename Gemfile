source 'https://rubygems.org'

# You may use http://rbenv.org/ or https://rvm.io/ to install and use this version
# 3.1 is the minimum for activesupport 7.2, the oldest line with the fixes
# required below.
ruby ">= 3.1.0"

# Exclude problematic cocoapods versions
gem 'cocoapods', '>= 1.13', '!= 1.15.0', '!= 1.15.1'
# 7.2.3.1 fixes GHSA-cg4j-q9v8-6v38, GHSA-89vf-4333-qx8v and
# GHSA-2j26-frm8-cmj9. CocoaPods caps activesupport below 8.
gem 'activesupport', '~> 7.2', '>= 7.2.3.1'

# Ruby 3.4 compatibility
gem 'bigdecimal'
gem 'logger'
gem 'benchmark'
gem 'mutex_m'
gem 'nkf'
gem 'concurrent-ruby', '< 1.3.8'

# Deliberate divergence from the React Native template, which still pins
# xcodeproj '< 1.26.0'. Our app extension targets (ShareQR, NWCWidget) use
# PBXFileSystemSynchronizedRootGroup, an ISA that Xcodeproj only understands
# from 1.26.0 on, so the template pin makes `bundle exec pod install` fail
# outright here. 1.28.0 adds Xcode 26 project support and 1.28.1 declares the
# nkf and base64 dependencies that Bundler needs on Ruby 3.4+.
gem 'xcodeproj', '>= 1.28.1'
