require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name         = "react-native-qrcode-local-image"
  s.version      = package['version']
  s.summary      = "A local qrcode image parse for react-native, support for ios and android"

  s.authors      = { "YunJiang.Fang" => "42550564@qq.com" }
  s.license      = "MIT"
  s.platform     = :ios, "9.0"

  s.source_files  = "ios/**/*.{h,m}"
  s.homepage      = 'https://'
  s.source        = { :path => '.' }
  s.requires_arc  = true
  s.static_framework = true

  s.dependency 'React'
end
