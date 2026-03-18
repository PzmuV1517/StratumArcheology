import { Platform, View } from "react-native";
import "./StarBorder.css";

const StarBorder = ({
  as: Component = Platform.OS === "web" ? "button" : View,
  className = "",
  color = "white",
  speed = "6s",
  thickness = 1,
  children,
  onPress,
  onClick,
  ...rest
}) => {
  const resolvedPressHandler = onClick || onPress;

  // Only apply className and HTML styles on web
  const webProps =
    Platform.OS === "web"
      ? {
          className: `star-border-container ${className}`,
          onClick: resolvedPressHandler,
          style: {
            padding: `${thickness}px 0`,
            ...(rest.style || {}),
          },
        }
      : {};

  const nativeProps =
    Platform.OS === "web"
      ? {}
      : {
          onPress: resolvedPressHandler,
        };

  return (
    <Component {...webProps} {...nativeProps} {...rest}>
      {Platform.OS === "web" ? (
        <>
          <div
            className="border-gradient-bottom"
            style={{
              background: `radial-gradient(circle, ${color}, transparent 10%)`,
              animationDuration: speed,
            }}
          ></div>
          <div
            className="border-gradient-top"
            style={{
              background: `radial-gradient(circle, ${color}, transparent 10%)`,
              animationDuration: speed,
            }}
          ></div>
          <div className="inner-content">{children}</div>
        </>
      ) : (
        // Native: just render children inside a View
        <View style={{ padding: thickness }}>{children}</View>
      )}
    </Component>
  );
};

export default StarBorder;
