﻿import enums = require("ui/enums");
import common = require("./font-common");
import * as applicationModule from "application";
import * as typesModule from "utils/types";
import * as traceModule from "trace";
import * as fileSystemModule from "file-system";

var typefaceCache = new Map<string, android.graphics.Typeface>();
var appAssets: android.content.res.AssetManager;
var FONTS_BASE_PATH = "/fonts/";

export class Font extends common.Font {
    public static default = new Font(undefined, undefined, enums.FontStyle.normal, enums.FontWeight.normal);

    private _typeface: android.graphics.Typeface;

    constructor(family: string, size: number, style: string, weight: string) {
        super(family, size, style, weight);
    }

    public withFontFamily(family: string): Font {
        return new Font(family, this.fontSize, this.fontStyle, this.fontWeight);
    }

    public withFontStyle(style: string): Font {
        return new Font(this.fontFamily, this.fontSize, style, this.fontWeight);
    }

    public withFontWeight(weight: string): Font {
        return new Font(this.fontFamily, this.fontSize, this.fontStyle, weight);
    }

    public withFontSize(size: number): Font {
        return new Font(this.fontFamily, size, this.fontStyle, this.fontWeight);
    }

    public getAndroidTypeface(): android.graphics.Typeface {
        if (!this._typeface) {
            var style: number = 0;

            if (this.isBold) {
                style |= android.graphics.Typeface.BOLD;
            }

            if (this.isItalic) {
                style |= android.graphics.Typeface.ITALIC;
            }

            var typeFace = this.getTypeFace(this.fontFamily);
            this._typeface = android.graphics.Typeface.create(typeFace, style);
        }

        return this._typeface;
    }

    private getTypeFace(fontFamily: string): android.graphics.Typeface {
        var fonts = common.parseFontFamily(fontFamily);
        var result = null;
        if (fonts.length === 0) {
            return null;
        }

        for (var i = 0; i < fonts.length; i++) {
            switch (fonts[i].toLowerCase()) {
                case common.genericFontFamilies.serif:
                    result = android.graphics.Typeface.SERIF;
                    break;

                case common.genericFontFamilies.sansSerif:
                    result = android.graphics.Typeface.SANS_SERIF;
                    break;

                case common.genericFontFamilies.monospace:
                    result = android.graphics.Typeface.MONOSPACE;
                    break;

                default:
                    result = this.loadFontFromFile(fonts[i]);
                    break;
            }

            if (result) {
                return result;
            }
        }

        return null;
    }

    private loadFontFromFile(fontFamily: string): android.graphics.Typeface {
        var application: typeof applicationModule = require("application");

        appAssets = appAssets || application.android.context.getAssets();
        if (!appAssets) {
            return null;
        }

        var types: typeof typesModule = require("utils/types");

        var result = typefaceCache.get(fontFamily);
        // Check for undefined explicitly as null mean we tried to load the font, but failed.
        if (types.isUndefined(result)) {
            result = null;
            var trace: typeof traceModule = require("trace");
            var fs: typeof fileSystemModule  = require("file-system");

            var fontAssetPath: string;
            var basePath = fs.path.join(fs.knownFolders.currentApp().path, "fonts", fontFamily);
            if (fs.File.exists(basePath + ".ttf")) {
                fontAssetPath = FONTS_BASE_PATH + fontFamily + ".ttf";
            }
            else if (fs.File.exists(basePath + ".otf")) {
                fontAssetPath = FONTS_BASE_PATH + fontFamily + ".otf";
            }
            else {
                trace.write("Could not find font file for " + fontFamily, trace.categories.Error, trace.messageType.error);
            }

            if (fontAssetPath) {
                try {
                    fontAssetPath = fs.path.join(fs.knownFolders.currentApp().path, fontAssetPath);
                    result = android.graphics.Typeface.createFromFile(fontAssetPath)
                } catch (e) {
                    trace.write("Error loading font asset: " + fontAssetPath, trace.categories.Error, trace.messageType.error);
                }
            }
            typefaceCache.set(fontFamily, result);
        }

        return result;
    }
}
