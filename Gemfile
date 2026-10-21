source 'https://rubygems.org'

# You may use http://rbenv.org/ or https://rvm.io/ to install and use this version
ruby ">= 2.6.10"

# Exclude problematic cocoapods versions
gem 'cocoapods', '>= 1.13', '!= 1.15.0', '!= 1.15.1'
gem 'activesupport', '>= 6.1.7.5', '!= 7.1.0'

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
