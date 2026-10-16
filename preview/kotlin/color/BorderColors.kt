// Generated from tokens/ by build.mjs. Do not edit.
package com.glsnxt.designtokens.color

import androidx.compose.ui.graphics.Color

data class BorderColors(
    val default: Color,
    val subtle: Color,
    val action: Color,
    val focus: Color,
    val disabled: Color,
    val error: Color,
    val success: Color,
    val warning: Color,
    val info: Color,
    val selectionDefault: Color,
)

fun lightBorderColors() = BorderColors(
    default = PrimitiveColors.Gray.Gray550,
    subtle = PrimitiveColors.Gray.Gray300,
    action = PrimitiveColors.Blue.Blue700,
    focus = PrimitiveColors.Blue.Blue500,
    disabled = PrimitiveColors.Gray.Gray300,
    error = PrimitiveColors.Red.Red700,
    success = PrimitiveColors.Green.Green800,
    warning = PrimitiveColors.Orange.Orange700,
    info = PrimitiveColors.Blue.Blue600,
    selectionDefault = PrimitiveColors.Blue.Blue700,
)

fun darkBorderColors() = BorderColors(
    default = PrimitiveColors.GrayDark.GrayDark850,
    subtle = PrimitiveColors.GrayDark.GrayDark500,
    action = PrimitiveColors.BlueDark.BlueDark800,
    focus = PrimitiveColors.BlueDark.BlueDark800,
    disabled = PrimitiveColors.GrayDark.GrayDark500,
    error = PrimitiveColors.RedDark.RedDark800,
    success = PrimitiveColors.GreenDark.GreenDark700,
    warning = PrimitiveColors.OrangeDark.OrangeDark700,
    info = PrimitiveColors.BlueDark.BlueDark800,
    selectionDefault = PrimitiveColors.BlueDark.BlueDark800,
)
