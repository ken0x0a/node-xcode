/** A project UUID is a 24 character long string */
export type XC_PROJ_UUID = string;

/** A type to document when a comment key is being passed around.
 * The compiler doesn't really do anything other than validate it is a string.
 * When a variable is of this type, it is expected to match "<XC_PROJ_UUID>_comment"
 */
export type XC_COMMENT_KEY = string;

export type TARGET_TYPE =
  | "application"
  | "app_extension"
  | "bundle"
  | "command_line_tool"
  | "dynamic_library"
  | "framework"
  | "static_library"
  | "unit_test_bundle"
  | "watch_app"
  | "watch_extension"
  | "watch2_app"
  | "watch2_extension";

export type PRODUCT_TYPE =
  | "com.apple.product-type.application"
  | "com.apple.product-type.app-extension"
  | "com.apple.product-type.bundle"
  | "com.apple.product-type.tool"
  | "com.apple.product-type.library.dynamic"
  | "com.apple.product-type.framework"
  | "com.apple.product-type.library.static"
  | "com.apple.product-type.bundle.unit-test"
  | "com.apple.product-type.application.watchapp"
  | "com.apple.product-type.watchkit-extension"
  | "com.apple.product-type.application.watchapp2"
  | "com.apple.product-type.watchkit2-extension";
