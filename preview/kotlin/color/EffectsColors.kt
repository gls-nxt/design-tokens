// Generated from tokens/ by build.mjs. Do not edit.
package com.glsnxt.designtokens.color

import androidx.compose.ui.graphics.Color

data class EffectsColors(
    val shadow1: Color,
    val shadow2: Color,
    val shadow3: Color,
    val shadow4: Color,
    val shadow5: Color,
)

fun lightEffectsColors() = EffectsColors(
    shadow1 = PrimitiveColors.BlackAlpha.BlackAlpha1,
    shadow2 = PrimitiveColors.BlackAlpha.BlackAlpha2,
    shadow3 = PrimitiveColors.BlackAlpha.BlackAlpha3,
    shadow4 = PrimitiveColors.BlackAlpha.BlackAlpha4,
    shadow5 = PrimitiveColors.BlackAlpha.BlackAlpha5,
)

fun darkEffectsColors() = EffectsColors(
    shadow1 = PrimitiveColors.BlackAlpha.BlackAlpha8,
    shadow2 = PrimitiveColors.BlackAlpha.BlackAlpha12,
    shadow3 = PrimitiveColors.BlackAlpha.BlackAlpha16,
    shadow4 = PrimitiveColors.BlackAlpha.BlackAlpha24,
    shadow5 = PrimitiveColors.BlackAlpha.BlackAlpha32,
)
