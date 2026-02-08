require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'LiquidReact'
  s.version        = package['version']
  s.summary        = 'UIKit native components for React Native / Expo'
  s.description    = 'Wraps UIButton (with UIMenu), UISegmentedControl and more for Expo apps'
  s.license        = { :type => 'MIT' }
  s.author         = 'QuantumBits'
  s.homepage       = 'https://github.com/example'
  s.platforms      = { ios: '15.1' }
  s.swift_version  = '5.4'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Recursively include all Swift files in ios/ and its subdirectories
  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
