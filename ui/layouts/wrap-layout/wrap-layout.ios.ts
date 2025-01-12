﻿import utils = require("utils/utils");
import common = require("./wrap-layout-common");
import {View} from "ui/core/view";
import {Orientation} from "ui/enums";
import {CommonLayoutParams, nativeLayoutParamsProperty} from "ui/styling/style";

global.moduleMerge(common, exports);

export class WrapLayout extends common.WrapLayout {

    private _lengths: Array<number> = new Array<number>();

    private static getChildMeasureSpec(parentMode: number, parentLength: number, itemLength): number {
        if (itemLength > 0) {
            return utils.layout.makeMeasureSpec(itemLength, utils.layout.EXACTLY);
        }
        else if (parentMode === utils.layout.UNSPECIFIED) {
            return utils.layout.makeMeasureSpec(0, utils.layout.UNSPECIFIED);
        }
        else {
            return utils.layout.makeMeasureSpec(parentLength, utils.layout.AT_MOST);
        }
    }

    public onMeasure(widthMeasureSpec: number, heightMeasureSpec: number): void {
        WrapLayout.adjustChildrenLayoutParams(this, widthMeasureSpec, heightMeasureSpec);
        super.onMeasure(widthMeasureSpec, heightMeasureSpec);

        var measureWidth = 0;
        var measureHeight = 0;

        var width = utils.layout.getMeasureSpecSize(widthMeasureSpec);
        var widthMode = utils.layout.getMeasureSpecMode(widthMeasureSpec);

        var height = utils.layout.getMeasureSpecSize(heightMeasureSpec);
        var heightMode = utils.layout.getMeasureSpecMode(heightMeasureSpec);

        var density = utils.layout.getDisplayDensity();
        var childWidthMeasureSpec: number = WrapLayout.getChildMeasureSpec(widthMode, width, this.itemWidth * density);
        var childHeightMeasureSpec: number = WrapLayout.getChildMeasureSpec(heightMode, height, this.itemHeight * density);

        var remainingWidth = widthMode === utils.layout.UNSPECIFIED ? Number.MAX_VALUE : width - ((this.paddingLeft + this.paddingRight) * density);
        var remainingHeight = heightMode === utils.layout.UNSPECIFIED ? Number.MAX_VALUE : height - ((this.paddingTop + this.paddingBottom) * density);

        this._lengths.length = 0;

        var rowOrColumn = 0;
        var maxLength = 0;
        var isVertical = this.orientation === Orientation.vertical;

        for (let i = 0, count = this.getChildrenCount(); i < count; i++) {
            let child = this.getChildAt(i);
            if (!child._isVisible) {
                continue;
            }

            var childSize = View.measureChild(this, child, childWidthMeasureSpec, childHeightMeasureSpec);
            if (isVertical) {
                if (childSize.measuredHeight > remainingHeight) {
                    rowOrColumn++;
                    maxLength = Math.max(maxLength, measureHeight);
                    measureHeight = childSize.measuredHeight;
                    remainingWidth = height - childSize.measuredHeight;
                    this._lengths[rowOrColumn] = childSize.measuredWidth;
                }
                else {
                    remainingHeight -= childSize.measuredHeight;
                    measureHeight += childSize.measuredHeight;
                }
            }
            else {
                if (childSize.measuredWidth > remainingWidth) {
                    rowOrColumn++;
                    maxLength = Math.max(maxLength, measureWidth);
                    measureWidth = childSize.measuredWidth;
                    remainingWidth = width - childSize.measuredWidth;
                    this._lengths[rowOrColumn] = childSize.measuredHeight;
                }
                else {
                    remainingWidth -= childSize.measuredWidth;
                    measureWidth += childSize.measuredWidth;
                }
            }

            if (this._lengths.length <= rowOrColumn) {
                this._lengths[rowOrColumn] = isVertical ? childSize.measuredWidth: childSize.measuredHeight;
            }
            else {
                this._lengths[rowOrColumn] = Math.max(this._lengths[rowOrColumn], isVertical ? childSize.measuredWidth : childSize.measuredHeight);
            }
        }

        if (isVertical) {
            measureHeight = Math.max(maxLength, measureHeight);
            this._lengths.forEach((value, index, array) => {
                measureWidth += value;
            });
        }
        else {
            measureWidth = Math.max(maxLength, measureWidth);
            this._lengths.forEach((value, index, array) => {
                measureHeight += value;
            });
        }

        measureWidth += (this.paddingLeft + this.paddingRight) * density;
        measureHeight += (this.paddingTop + this.paddingBottom) * density;

        measureWidth = Math.max(measureWidth, this.minWidth * density);
        measureHeight = Math.max(measureHeight, this.minHeight * density);

        var widthAndState = View.resolveSizeAndState(measureWidth, width, widthMode, 0);
        var heightAndState = View.resolveSizeAndState(measureHeight, height, heightMode, 0);

        this.setMeasuredDimension(widthAndState, heightAndState);
    }

    public onLayout(left: number, top: number, right: number, bottom: number): void {
        super.onLayout(left, top, right, bottom);

        var isVertical = this.orientation === Orientation.vertical;

        var density = utils.layout.getDisplayDensity();

        var childLeft = this.paddingLeft * density;
        var childTop = this.paddingTop * density;
        var childrenLength: number;
        if (isVertical) {
            childrenLength = bottom - top - (this.paddingBottom * density);
        }
        else {
            childrenLength = right - left - (this.paddingRight * density);
        }

        var rowOrColumn = 0;
        for (let i = 0, count = this.getChildrenCount(); i < count; i++) {
            let child = this.getChildAt(i);
            if (!child._isVisible) {
                continue;
            }

            // Add margins because layoutChild will sustract them.
            // * density converts them to device pixels.
            let lp: CommonLayoutParams = child.style._getValue(nativeLayoutParamsProperty);

            let childWidth = child.getMeasuredWidth() + (lp.leftMargin + lp.rightMargin) * density;
            let childHeight = child.getMeasuredHeight() + (lp.topMargin + lp.bottomMargin) * density;

            let length = this._lengths[rowOrColumn];
            if (isVertical) {                
                childWidth = length;
                childHeight = this.itemHeight > 0 ? this.itemHeight * density : childHeight;
                if (childTop + childHeight > childrenLength) {
                    // Move to top.
                    childTop = this.paddingTop * density;

                    // Move to right with current column width.
                    childLeft += length;

                    // Move to next column.
                    rowOrColumn++;

                    // Take current column width.
                    childWidth = length = this._lengths[rowOrColumn];
                }
            }
            else {
                childWidth = this.itemWidth > 0 ? this.itemWidth * density : childWidth;
                childHeight = length;
                if (childLeft + childWidth > childrenLength) {
                    // Move to left.
                    childLeft = this.paddingLeft * density;

                    // Move to bottom with current row height.
                    childTop += length;

                    // Move to next column.
                    rowOrColumn++;

                    // Take current row height.
                    childHeight = length = this._lengths[rowOrColumn];
                }
            }

            View.layoutChild(this, child, childLeft, childTop, childLeft + childWidth, childTop + childHeight);

            if (isVertical) {
                // Move next child Top position to bottom.
                childTop += childHeight;
            }
            else {
                // Move next child Left position to right.
                childLeft += childWidth;
            }
        }

        WrapLayout.restoreOriginalParams(this);
    }
}