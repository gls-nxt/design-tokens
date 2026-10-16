// Generated from tokens/ by build.mjs. Do not edit.
package com.glsnxt.designtokens.color

import androidx.compose.ui.graphics.Color

data class TextColors(
    val primary: Color,
    val secondary: Color,
    val disabled: Color,
    val inverse: Color,
    val onAction: Color,
    val onWhite: Color,
    val link: Color,
    val linkPressed: Color,
    val linkDisabled: Color,
    val error: Color,
    val success: Color,
    val warning: Color,
    val info: Color,
)

fun lightTextColors() = TextColors(
    primary = PrimitiveColors.Gray.Gray1200,
    secondary = PrimitiveColors.Gray.Gray600,
    disabled = PrimitiveColors.Gray.Gray500,
    inverse = PrimitiveColors.Base.BaseWhite,
    onAction = PrimitiveColors.Base.BaseWhite,
    onWhite = PrimitiveColors.Gray.Gray1200,
    link = PrimitiveColors.Blue.Blue700,
    linkPressed = PrimitiveColors.Blue.Blue900,
    linkDisabled = PrimitiveColors.Blue.Blue500,
    error = PrimitiveColors.Red.Red900,
    success = PrimitiveColors.Green.Green1000,
    warning = PrimitiveColors.Orange.Orange1000,
    info = PrimitiveColors.Blue.Blue600,
)

fun darkTextColors() = TextColors(
    primary = PrimitiveColors.GrayDark.GrayDark1200,
    secondary = PrimitiveColors.GrayDark.GrayDark1100,
    disabled = PrimitiveColors.GrayDark.GrayDark1000,
    inverse = PrimitiveColors.Gray.Gray1200,
    onAction = PrimitiveColors.Base.BaseWhite,
    onWhite = PrimitiveColors.Gray.Gray1200,
    link = PrimitiveColors.BlueDark.BlueDark1100,
    linkPressed = PrimitiveColors.BlueDark.BlueDark1200,
    linkDisabled = PrimitiveColors.GrayDark.GrayDark900,
    error = PrimitiveColors.RedDark.RedDark1000,
    success = PrimitiveColors.GreenDark.GreenDark900,
    warning = PrimitiveColors.OrangeDark.OrangeDark900,
    info = PrimitiveColors.BlueDark.BlueDark900,
)
