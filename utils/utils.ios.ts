import dts = require("utils/utils");
import common = require("./utils-common");
import colorModule = require("color");
import enums = require("ui/enums");
import * as typesModule from "utils/types";

global.moduleMerge(common, exports);

function isOrientationLandscape(orientation: number) {
    return orientation === UIDeviceOrientation.UIDeviceOrientationLandscapeLeft || orientation === UIDeviceOrientation.UIDeviceOrientationLandscapeRight;
}

export module layout {
    var MODE_SHIFT = 30;
    var MODE_MASK = 0x3 << MODE_SHIFT;

    export function makeMeasureSpec(size: number, mode: number): number {
        return (Math.round(size) & ~MODE_MASK) | (mode & MODE_MASK);
    }

    export function getDisplayDensity(): number {
        return 1;
    }

    export function toDevicePixels(value: number): number {
        return value * getDisplayDensity();
    }

    export function toDeviceIndependentPixels(value: number): number {
        return value / getDisplayDensity();
    }
}

export module ios {

    export function setTextAlignment(view: dts.ios.TextUIView, value: string) {
        switch (value) {
            case enums.TextAlignment.left:
                view.textAlignment = NSTextAlignment.NSTextAlignmentLeft;
                break;
            case enums.TextAlignment.center:
                view.textAlignment = NSTextAlignment.NSTextAlignmentCenter;
                break;
            case enums.TextAlignment.right:
                view.textAlignment = NSTextAlignment.NSTextAlignmentRight;
                break;
            default:
                break;
        }
    }

    export function setTextDecoration(view: dts.ios.TextUIView | UIButton, value: string) {
        var attributes: NSMutableDictionary = NSMutableDictionary.alloc().init();
        var values = (value + "").split(" ");

        if (values.indexOf(enums.TextDecoration.underline) !== -1) {
            attributes.setObjectForKey(NSUnderlineStyle.NSUnderlineStyleSingle, NSUnderlineStyleAttributeName);
        }

        if (values.indexOf(enums.TextDecoration.lineThrough) !== -1) {
            attributes.setObjectForKey(NSUnderlineStyle.NSUnderlineStyleSingle, NSStrikethroughStyleAttributeName);
        }

        if (values.indexOf(enums.TextDecoration.none) !== -1) {
            attributes = NSMutableDictionary.alloc().init();
        }

        let newAttributedText: NSMutableAttributedString;
        let attributedText = getNSAttributedStringFromView(view);

        if (attributedText) {
            newAttributedText = getNewAttributedString(attributedText, { attributesToAdd: attributes });
        } else {
            var types: typeof typesModule = require("utils/types");
            var newStr = types.isString((<dts.ios.TextUIView>view).text) ? (<dts.ios.TextUIView>view).text : "";
            newAttributedText = NSMutableAttributedString.alloc().initWithStringAttributes(newStr, attributes);
        }

        setAttributedStringToView(view, newAttributedText);
    }

    export function setTextTransform(view: dts.ios.TextUIView | UIButton, value: string) {
        let str = getNSStringFromView(view);
        let result: string;

        switch (value) {
            case enums.TextTransform.none:
            default:
                result = view["originalString"] || str;
                break;
            case enums.TextTransform.uppercase:
                result = str.uppercaseString;
                break;
            case enums.TextTransform.lowercase:
                result = str.lowercaseString;
                break;
            case enums.TextTransform.capitalize:
                result = str.capitalizedString;
                break;
        }

        if (!view["originalString"]) {
            view["originalString"] = str;
        }

        let attributedText = getNSAttributedStringFromView(view);

        if (attributedText) {
            setAttributedStringToView(view, getNewAttributedString(getNSAttributedStringFromView(view), { newValue: result }));
        } else {
            setStringToView(view, result);
        }
    }

    function getNSStringFromView(view: any): NSString {
        let result: string;

        if (view instanceof UIButton) {
            let attrTitle = (<UIButton>view).titleLabel.attributedText;
            result = attrTitle ? attrTitle.string : (<UIButton>view).titleLabel.text;
        }
        else {
            let attrText = (<UITextView>view).attributedText;
            result = attrText ? attrText.string : (<UITextView>view).text;
        }

        return NSString.alloc().initWithString(result || "");
    }

    function setStringToView(view: any, str: string) {
        if (view instanceof UIButton) {
            (<UIButton>view).setTitleForState(str, UIControlState.UIControlStateNormal);
        }
        else {
            (<dts.ios.TextUIView>view).text = str;
        }
    }

    function getNSAttributedStringFromView(view: any): NSAttributedString {
        return view instanceof UIButton && (<UIButton>view).titleLabel.attributedText || (<dts.ios.TextUIView>view).attributedText;
    }

    function setAttributedStringToView(view: any, str: NSMutableAttributedString) {
        if (view instanceof UIButton) {
            (<UIButton>view).setAttributedTitleForState(str, UIControlState.UIControlStateNormal);
        }
        else {
            (<dts.ios.TextUIView>view).attributedText = str;
        }
    }

    interface NewAttributedStringOptions {
        newValue?: string;
        attributesToAdd?: NSMutableDictionary;
    }

    function getNewAttributedString(source: NSAttributedString, options: NewAttributedStringOptions): NSMutableAttributedString {
        let result = source.mutableCopy();
        let attributes = NSMutableArray.array();
        let range = { location: 0, length: result.length };

        result.enumerateAttributesInRangeOptionsUsingBlock(range, 0, (attrs, r, stop) => {
            attributes.addObject({ attrs: attrs, range: NSValue.valueWithRange(r) });
        });

        if (options.newValue) {
            result.replaceCharactersInRangeWithString(range, options.newValue);
        }

        if (options.attributesToAdd) {
            attributes.addObject({ attrs: options.attributesToAdd, range: NSValue.valueWithRange(range) });
        }

        for (let i = 0; i < attributes.count; i++) {
            let attribute = attributes[i];
            result.setAttributesRange(attribute["attrs"], attribute["range"].rangeValue);
        }

        return result;
    }

    export function setWhiteSpace(view: dts.ios.TextUIView, value: string, parentView?: UIView) {
        if (value === enums.WhiteSpace.normal) {
            view.lineBreakMode = NSLineBreakMode.NSLineBreakByWordWrapping;
            view.numberOfLines = 0;
        }
        else {
            if (parentView) {
                view.lineBreakMode = NSLineBreakMode.NSLineBreakByTruncatingMiddle;
            } else {
                view.lineBreakMode = NSLineBreakMode.NSLineBreakByTruncatingTail;
            }
            view.numberOfLines = 1;
        }
    }

    export module collections {
        export function jsArrayToNSArray(str: string[]): NSArray {
            return NSArray.arrayWithArray(<any>str);
        }

        export function nsArrayToJSArray(a: NSArray): Array<Object> {
            var arr = [];
            if ("undefined" !== typeof a) {
                let count = a.count;
                for (let i = 0; i < count; i++) {
                    arr.push(a.objectAtIndex(i));
                }
            }

            return arr;
        }
    }

    export function getColor(uiColor: UIColor): colorModule.Color {
        var redRef = new interop.Reference<number>();
        var greenRef = new interop.Reference<number>();
        var blueRef = new interop.Reference<number>();
        var alphaRef = new interop.Reference<number>();

        uiColor.getRedGreenBlueAlpha(redRef, greenRef, blueRef, alphaRef);
        var red = redRef.value * 255;
        var green = greenRef.value * 255;
        var blue = blueRef.value * 255;
        var alpha = alphaRef.value * 255;

        return new colorModule.Color(alpha, red, green, blue);
    }

    export function isLandscape(): boolean {
        var device = UIDevice.currentDevice();
        var statusBarOrientation = UIApplication.sharedApplication().statusBarOrientation;
        var isStatusBarOrientationLandscape = isOrientationLandscape(statusBarOrientation);
        return isOrientationLandscape(device.orientation) || isStatusBarOrientationLandscape;
    }

    export var MajorVersion = NSString.stringWithString(UIDevice.currentDevice().systemVersion).intValue;
}

export function GC() {
    __collect();
}

export function openUrl(location: string): boolean {
    try {
        var url = NSURL.URLWithString(location.trim());
        if (UIApplication.sharedApplication().canOpenURL(url)) {
            return UIApplication.sharedApplication().openURL(url);
        }
    }
    catch (e) {
        // We Don't do anything with an error.  We just output it
        console.error("Error in OpenURL", e);
    }
    return false;
}
