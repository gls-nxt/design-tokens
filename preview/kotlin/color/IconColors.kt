// Generated from tokens/ by build.mjs. Do not edit.
package com.glsnxt.designtokens.color

import androidx.compose.ui.graphics.Color

data class IconColors(
    val default: Color,
    val secondary: Color,
    val disabled: Color,
    val onAction: Color,
    val action: Color,
    val error: Color,
    val success: Color,
    val warning: Color,
    val info: Color,
    val inverse: Color,
)

fun lightIconColors() = IconColors(
    default = PrimitiveColors.Gray.Gray1200,
    secondary = PrimitiveColors.Gray.Gray600,
    disabled = PrimitiveColors.Gray.Gray500,
    onAction = PrimitiveColors.Base.BaseWhite,
    action = PrimitiveColors.Blue.Blue700,
    error = PrimitiveColors.Red.Red900,
    success = PrimitiveColors.Green.Green1000,
    warning = PrimitiveColors.Orange.Orange1000,
    info = PrimitiveColors.Blue.Blue500,
    inverse = PrimitiveColors.Base.BaseWhite,
)

fun darkIconColors() = IconColors(
    default = PrimitiveColors.GrayDark.GrayDark1200,
    secondary = PrimitiveColors.GrayDark.GrayDark1100,
    disabled = PrimitiveColors.GrayDark.GrayDark1000,
    onAction = PrimitiveColors.Base.BaseWhite,
    action = PrimitiveColors.BlueDark.BlueDark1000,
    error = PrimitiveColors.RedDark.RedDark900,
    success = PrimitiveColors.GreenDark.GreenDark900,
    warning = PrimitiveColors.OrangeDark.OrangeDark900,
    info = PrimitiveColors.BlueDark.BlueDark900,
    inverse = PrimitiveColors.Gray.Gray1200,
)
