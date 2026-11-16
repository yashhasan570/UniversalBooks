package com.universalbooks.native_bridge

/** `genericPen` flavor: no vendor SDK; JS draws via pointer events. */
object PenInputControllerFactory {
    fun create(): PenInputController = NoOpPenInputController
}
