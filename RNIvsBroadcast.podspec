require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))
ios_sdk = package["ivsSdk"]["ios"]

# AmazonIVSBroadcast is no longer published to CocoaPods (the last pod is 1.38.0), so the
# xcframework is downloaded from AWS and vendored. prepare_command never runs for pods
# installed from a local path (which is how React Native autolinks), hence the fetch here.
sdk_url = ENV["IVS_BROADCAST_SDK_URL"] || ios_sdk["url"]
sdk_sha = ENV["IVS_BROADCAST_SDK_SHA256"] || ios_sdk["sha256"]
unless system("bash", File.join(__dir__, "scripts", "fetch-ios-sdk.sh"), sdk_url, sdk_sha)
  raise "react-native-ivs-broadcast: could not fetch the Amazon IVS Broadcast SDK (see output above)."
end

Pod::Spec.new do |s|
  s.name         = "RNIvsBroadcast"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => "https://github.com/aliudurim/react-native-ivs-broadcast.git", :tag => "v#{s.version}" }

  s.source_files = "ios/*.{h,m,mm,cpp}"
  s.private_header_files = "ios/*.h"
  s.vendored_frameworks = "ios/Frameworks/AmazonIVSBroadcast.xcframework"
  s.frameworks = "AVFoundation", "CoreMedia", "CoreVideo", "UIKit"

  install_modules_dependencies(s)
end
