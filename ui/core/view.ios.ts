﻿import viewCommon = require("./view-common");
import trace = require("trace");
import utils = require("utils/utils");
import dependencyObservable = require("ui/core/dependency-observable");
import proxy = require("ui/core/proxy");
import style = require("ui/styling/style");
import styling = require("ui/styling");
import enums = require("ui/enums");
import * as backgroundModule from "ui/styling/background";

global.moduleMerge(viewCommon, exports);

function onIdPropertyChanged(data: dependencyObservable.PropertyChangeData) {
    var view = <View>data.object;
    if (!view._nativeView) {
        return;
    }

    view._nativeView.accessibilityIdentifier = data.newValue;
}

(<proxy.PropertyMetadata>viewCommon.View.idProperty.metadata).onSetNativeValue = onIdPropertyChanged;

function onTransfromPropertyChanged(data: dependencyObservable.PropertyChangeData) {
    var view = <View>data.object;
    view._updateNativeTransform();
}
(<proxy.PropertyMetadata>viewCommon.View.translateXProperty.metadata).onSetNativeValue = onTransfromPropertyChanged;
(<proxy.PropertyMetadata>viewCommon.View.translateYProperty.metadata).onSetNativeValue = onTransfromPropertyChanged;
(<proxy.PropertyMetadata>viewCommon.View.scaleXProperty.metadata).onSetNativeValue = onTransfromPropertyChanged;
(<proxy.PropertyMetadata>viewCommon.View.scaleYProperty.metadata).onSetNativeValue = onTransfromPropertyChanged;
(<proxy.PropertyMetadata>viewCommon.View.rotateProperty.metadata).onSetNativeValue = onTransfromPropertyChanged;

function onOriginPropertyChanged(data: dependencyObservable.PropertyChangeData) {
    var view = <View>data.object;
    view._updateOriginPoint();
}
(<proxy.PropertyMetadata>viewCommon.View.originXProperty.metadata).onSetNativeValue = onOriginPropertyChanged;
(<proxy.PropertyMetadata>viewCommon.View.originYProperty.metadata).onSetNativeValue = onOriginPropertyChanged;

function onIsEnabledPropertyChanged(data: dependencyObservable.PropertyChangeData) {
    var view = <View>data.object;
    if (!view._nativeView) {
        return;
    }

    if (view._nativeView instanceof UIControl) {
        (<UIControl>view._nativeView).enabled = data.newValue;
    }
}
(<proxy.PropertyMetadata>viewCommon.View.isEnabledProperty.metadata).onSetNativeValue = onIsEnabledPropertyChanged;

function onIsUserInteractionEnabledPropertyChanged(data: dependencyObservable.PropertyChangeData) {
    var view = <View>data.object;
    if (!view._nativeView) {
        return;
    }

    view._nativeView.userInteractionEnabled = data.newValue;
}
(<proxy.PropertyMetadata>viewCommon.View.isUserInteractionEnabledProperty.metadata).onSetNativeValue = onIsUserInteractionEnabledPropertyChanged;

var PFLAG_FORCE_LAYOUT = 1;
var PFLAG_MEASURED_DIMENSION_SET = 1 << 1;
var PFLAG_LAYOUT_REQUIRED = 1 << 2;

export class View extends viewCommon.View {
    private _hasTransfrom = false;
    private _privateFlags: number;
    private _cachedFrame: CGRect;

    constructor() {
        super();
        this._privateFlags = PFLAG_LAYOUT_REQUIRED | PFLAG_FORCE_LAYOUT;
    }

    public _addViewCore(view: viewCommon.View, atIndex?: number) {
        super._addViewCore(view, atIndex);
        this.requestLayout();
    }

    public _removeViewCore(view: viewCommon.View) {
        super._removeViewCore(view);
        // TODO: Detach from the context?
        view._onDetached();
        this.requestLayout();
    }

    public onLoaded() {
        super.onLoaded();

        // TODO: It is very late to work with options here in the onLoaded method. 
        // We should not do anything that affects UI AFTER the widget has been loaded.
        utils.copyFrom(this._options, this);
        delete this._options;

        // We do not need to call this in iOS, since the native instance is created immediately
        // and any props that you set on our instance are immediately synced onto the native one.
        // _syncNativeProperties makes sense for Android only, where widgets are created later.
        // this._syncNativeProperties();
    }

    get _nativeView(): UIView {
        return this.ios;
    }

    get isLayoutRequested(): boolean {
        return (this._privateFlags & PFLAG_FORCE_LAYOUT) === PFLAG_FORCE_LAYOUT;
    }

    public requestLayout(): void {
        super.requestLayout();
        this._privateFlags |= PFLAG_FORCE_LAYOUT;

        var parent = <View>this.parent;
        if (parent && !parent.isLayoutRequested) {
            parent.requestLayout();
        }
    }

    public measure(widthMeasureSpec: number, heightMeasureSpec: number): void {

        var measureSpecsChanged = this._setCurrentMeasureSpecs(widthMeasureSpec, heightMeasureSpec);
        var forceLayout = (this._privateFlags & PFLAG_FORCE_LAYOUT) === PFLAG_FORCE_LAYOUT;
        if (forceLayout || measureSpecsChanged) {
            
            // first clears the measured dimension flag
            this._privateFlags &= ~PFLAG_MEASURED_DIMENSION_SET;

            // measure ourselves, this should set the measured dimension flag back
            this.onMeasure(widthMeasureSpec, heightMeasureSpec);
            this._privateFlags |= PFLAG_LAYOUT_REQUIRED;

            // flag not set, setMeasuredDimension() was not invoked, we raise
            // an exception to warn the developer
            if ((this._privateFlags & PFLAG_MEASURED_DIMENSION_SET) !== PFLAG_MEASURED_DIMENSION_SET) {
                throw new Error("onMeasure() did not set the measured dimension by calling setMeasuredDimension()");
            }
        }
    }

    public layout(left: number, top: number, right: number, bottom: number): void {
        var { boundsChanged, sizeChanged } = this._setCurrentLayoutBounds(left, top, right, bottom);
        this.layoutNativeView(left, top, right, bottom);
        if (boundsChanged || (this._privateFlags & PFLAG_LAYOUT_REQUIRED) === PFLAG_LAYOUT_REQUIRED) {
            this.onLayout(left, top, right, bottom);
            this._privateFlags &= ~PFLAG_LAYOUT_REQUIRED;
        }
        if (sizeChanged) {
            this._onSizeChanged();
        }
        this._privateFlags &= ~PFLAG_FORCE_LAYOUT;
    }

    public setMeasuredDimension(measuredWidth: number, measuredHeight: number): void {
        super.setMeasuredDimension(measuredWidth, measuredHeight);
        this._privateFlags |= PFLAG_MEASURED_DIMENSION_SET;
    }

    public onMeasure(widthMeasureSpec: number, heightMeasureSpec: number): void {
        var view = this._nativeView;
        let nativeWidth = 0;
        let nativeHeight = 0;

        if (view) {
            var width = utils.layout.getMeasureSpecSize(widthMeasureSpec);
            var widthMode = utils.layout.getMeasureSpecMode(widthMeasureSpec);

            var height = utils.layout.getMeasureSpecSize(heightMeasureSpec);
            var heightMode = utils.layout.getMeasureSpecMode(heightMeasureSpec);

            if (widthMode === utils.layout.UNSPECIFIED) {
                width = Number.POSITIVE_INFINITY;
            }

            if (heightMode === utils.layout.UNSPECIFIED) {
                height = Number.POSITIVE_INFINITY;
            }

            var nativeSize = view.sizeThatFits(CGSizeMake(width, height));
            nativeWidth = nativeSize.width;
            nativeHeight = nativeSize.height;
        }

        var measureWidth = Math.max(nativeWidth, this.minWidth);
        var measureHeight = Math.max(nativeHeight, this.minHeight);

        var widthAndState = View.resolveSizeAndState(measureWidth, width, widthMode, 0);
        var heightAndState = View.resolveSizeAndState(measureHeight, height, heightMode, 0);

        this.setMeasuredDimension(widthAndState, heightAndState);
    }

    public onLayout(left: number, top: number, right: number, bottom: number): void {
        //
    }

    public _setNativeViewFrame(nativeView: any, frame: any) {
        if (!CGRectEqualToRect(nativeView.frame, frame)) {
            trace.write(this + ", Native setFrame: = " + NSStringFromCGRect(frame), trace.categories.Layout);
            this._cachedFrame = frame;
            if (this._hasTransfrom) {
                // Always set identity transform before setting frame;
                let transform = nativeView.transform;
                nativeView.transform = CGAffineTransformIdentity;
                nativeView.frame = frame;
                nativeView.transform = transform;
            }
            else {
                nativeView.frame = frame;
            }
            var boundsOrigin = nativeView.bounds.origin;
            nativeView.bounds = CGRectMake(boundsOrigin.x, boundsOrigin.y, frame.size.width, frame.size.height);
        }
    }

    public layoutNativeView(left: number, top: number, right: number, bottom: number): void {
        if (!this._nativeView) {
            return;
        }

        // This is done because when rotated in iOS7 there is rotation applied on the first subview on the Window which is our frame.nativeView.view.
        // If we set it it should be transformed so it is correct. 
        // When in landscape in iOS 7 there is transformation on the first subview of the window so we set frame to its subview.
        // in iOS 8 we set frame to subview again otherwise we get clipped.
        var nativeView: UIView;
        if (!this.parent && this._nativeView.subviews.count > 0 && utils.ios.MajorVersion < 8) {
            trace.write(this + " has no parent. Setting frame to first child instead.", trace.categories.Layout);
            nativeView = (<UIView>this._nativeView.subviews[0]);
        }
        else {
            nativeView = this._nativeView;
        }

        var frame = CGRectMake(left, top, right - left, bottom - top);
        this._setNativeViewFrame(nativeView, frame);
    }

    public _updateLayout() {
        var oldBounds = this._getCurrentLayoutBounds();
        this.layoutNativeView(oldBounds.left, oldBounds.top, oldBounds.right, oldBounds.bottom);
    }

    public focus(): boolean {
        if (this.ios) {
            return this.ios.becomeFirstResponder();
        }

        return false;
    }

    private _onSizeChanged() {
        this.style._sizeChanged();
    }

    public _updateNativeTransform() {
        var newTransform = CGAffineTransformIdentity;
        newTransform = CGAffineTransformTranslate(newTransform, this.translateX, this.translateY);
        newTransform = CGAffineTransformRotate(newTransform, this.rotate * Math.PI / 180);
        newTransform = CGAffineTransformScale(newTransform, this.scaleX, this.scaleY);
        if (!CGAffineTransformEqualToTransform(this._nativeView.transform, newTransform)) {
            this._nativeView.transform = newTransform;
            this._hasTransfrom = this._nativeView && !CGAffineTransformEqualToTransform(this._nativeView.transform, CGAffineTransformIdentity);
        }
    }

    public _updateOriginPoint() {
        let newPoint = CGPointMake(this.originX, this.originY);
        this._nativeView.layer.anchorPoint = newPoint;
        if (this._cachedFrame) {
            this._setNativeViewFrame(this._nativeView, this._cachedFrame);
        }
    } 
}

export class CustomLayoutView extends View {

    private _view: UIView;

    constructor() {
        super();
        this._view = new UIView();
    }

    get ios(): UIView {
        return this._view;
    }

    get _nativeView(): UIView {
        return this._view;
    }

    public onMeasure(widthMeasureSpec: number, heightMeasureSpec: number): void {
        // Don't call super because it will set MeasureDimension. This method must be overriden and calculate its measuredDimensions.
    }

    public _addViewToNativeVisualTree(child: View, atIndex: number): boolean {
        super._addViewToNativeVisualTree(child);

        if (this._nativeView && child._nativeView) {
            var types = require("utils/types");

            if (types.isNullOrUndefined(atIndex) || atIndex >= this._nativeView.subviews.count) {
                this._nativeView.addSubview(child._nativeView);
            }
            else {
                this._nativeView.insertSubviewAtIndex(child._nativeView, atIndex);
            }

            return true;
        }

        return false;
    }

    public _removeViewFromNativeVisualTree(child: View): void {
        super._removeViewFromNativeVisualTree(child);

        if (child._nativeView) {
            child._nativeView.removeFromSuperview();
        }
    }
}

export class ViewStyler implements style.Styler {
    //Background methods
    private static setBackgroundInternalProperty(view: View, newValue: any) {
        var nativeView: UIView = <UIView>view._nativeView;
        if (nativeView) {
            var background: typeof backgroundModule = require("ui/styling/background");
            nativeView.backgroundColor = background.ios.createBackgroundUIColor(view);
        }
    }

    private static resetBackgroundInternalProperty(view: View, nativeValue: any) {
        var nativeView: UIView = <UIView>view._nativeView;
        if (nativeView) {
            nativeView.backgroundColor = nativeValue;
        }
    }

    private static getNativeBackgroundInternalValue(view: View): any {
        var nativeView: UIView = <UIView>view._nativeView;
        if (nativeView) {
            return nativeView.backgroundColor;
        }
        return undefined;
    }

    //Visibility methods
    private static setVisibilityProperty(view: View, newValue: any) {
        var nativeView: UIView = <UIView>view._nativeView;
        if (nativeView) {
            return nativeView.hidden = (newValue !== enums.Visibility.visible);
        }
    }

    private static resetVisibilityProperty(view: View, nativeValue: any) {
        var nativeView: UIView = <UIView>view._nativeView;
        if (nativeView) {
            return nativeView.hidden = false;
        }
    }

    //Opacity methods
    private static setOpacityProperty(view: View, newValue: any) {
        var nativeView: UIView = <UIView>view._nativeView;
        if (nativeView) {
            return nativeView.alpha = newValue;
        }
    }

    private static resetOpacityProperty(view: View, nativeValue: any) {
        var nativeView: UIView = <UIView>view._nativeView;
        if (nativeView) {
            return nativeView.alpha = 1.0;
        }
    }

    //Border width methods
    private static setBorderWidthProperty(view: View, newValue: any) {
        if (view._nativeView instanceof UIView) {
            (<UIView>view._nativeView).layer.borderWidth = newValue;
        }
    }

    private static resetBorderWidthProperty(view: View, nativeValue: any) {
        if (view._nativeView instanceof UIView) {
            (<UIView>view._nativeView).layer.borderWidth = nativeValue;
        }
    }

    private static getBorderWidthProperty(view: View): any {
        if (view._nativeView instanceof UIView) {
            return (<UIView>view._nativeView).layer.borderWidth;
        }
        return 0;
    }

    //Border color methods
    private static setBorderColorProperty(view: View, newValue: any) {
        if (view._nativeView instanceof UIView && newValue instanceof UIColor) {
            (<UIView>view._nativeView).layer.borderColor = (<UIColor>newValue).CGColor;
        }
    }

    private static resetBorderColorProperty(view: View, nativeValue: any) {
        if (view._nativeView instanceof UIView && nativeValue instanceof UIColor) {
            (<UIView>view._nativeView).layer.borderColor = nativeValue;
        }
    }

    private static getBorderColorProperty(view: View): any {
        if (view._nativeView instanceof UIView) {
            return (<UIView>view._nativeView).layer.borderColor;
        }
        return undefined;
    }

    //Border radius methods
    private static setBorderRadiusProperty(view: View, newValue: any) {
        if (view._nativeView instanceof UIView) {
            (<UIView>view._nativeView).layer.cornerRadius = newValue;
            (<UIView>view._nativeView).clipsToBounds = true;
        }
    }

    private static resetBorderRadiusProperty(view: View, nativeValue: any) {
        if (view._nativeView instanceof UIView) {
            (<UIView>view._nativeView).layer.cornerRadius = nativeValue;
        }
    }

    private static getBorderRadiusProperty(view: View): any {
        if (view._nativeView instanceof UIView) {
            return (<UIView>view._nativeView).layer.cornerRadius;
        }
        return 0;
    }

    public static registerHandlers() {
        style.registerHandler(style.backgroundInternalProperty, new style.StylePropertyChangedHandler(
            ViewStyler.setBackgroundInternalProperty,
            ViewStyler.resetBackgroundInternalProperty,
            ViewStyler.getNativeBackgroundInternalValue));

        style.registerHandler(style.visibilityProperty, new style.StylePropertyChangedHandler(
            ViewStyler.setVisibilityProperty,
            ViewStyler.resetVisibilityProperty));

        style.registerHandler(style.opacityProperty, new style.StylePropertyChangedHandler(
            ViewStyler.setOpacityProperty,
            ViewStyler.resetOpacityProperty));

        style.registerHandler(style.borderWidthProperty, new style.StylePropertyChangedHandler(
            ViewStyler.setBorderWidthProperty,
            ViewStyler.resetBorderWidthProperty,
            ViewStyler.getBorderWidthProperty));

        style.registerHandler(style.borderColorProperty, new style.StylePropertyChangedHandler(
            ViewStyler.setBorderColorProperty,
            ViewStyler.resetBorderColorProperty,
            ViewStyler.getBorderColorProperty));

        style.registerHandler(style.borderRadiusProperty, new style.StylePropertyChangedHandler(
            ViewStyler.setBorderRadiusProperty,
            ViewStyler.resetBorderRadiusProperty,
            ViewStyler.getBorderRadiusProperty));
    }
}

ViewStyler.registerHandlers();