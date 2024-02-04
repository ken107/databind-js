
export declare const dataBinder: {
  /**
   * You can change the names of the binding directives by modifying this object
   */
  directives: {
    bindView: string,
    bindParameter: string,
    bindVariable: string,
    bindStatement: string,
    bindEvent: string,
    bindRepeater: string
  }

  /**
   * Declare your views
   */
  views: {
    [name: string]: {template: HTMLElement, controller: Function}
  }

  /**
   * Set this to a function that will be called before each node is bound, you can use this to process custom directives
   */
  onDataBinding: ((node: HTMLElement) => void)|null

  /**
   * Removed repeater items are kept in a cache for reuse, the cache is cleared if it is not accessed within the TTL
   */
  repeaterCacheTTL: number

  /**
   * Process a binding expression and return a Property object.
   * You can subscribe to the Property to know when the expression changes value.
   * The remaining parameters provide binding sources for the binding expression.
   * `data` is an object whose properties can be bound to using `#prop` syntax.
   * `context` is the value of `this`, and whose properties can also be bound to using `#prop` syntax.
   * `scope` is an object whose properties are exposed as local variables inside `expr`,
   * these are not bound (changes do not trigger updates).
   */
  evalExpr<T>(expr: string, data: object, context: object, scope: object, debugInfo: string[]): Property<T>

  /**
   * Process a string containing zero or more {{binding expression}}s.
   * Return a Property object if there's at least one, NULL otherwise.
   * The Property is updated with the new interpolated text whenever any expression changes value.
   */
  evalText(text: string, data: object, context: object, scope: object, debugInfo: string[]): Property<string|null>

  /**
   * Convert the specified object property to a getter-setter, return the underlying Property object
   */
  getProp<T>(obj: object, name: string): Property<T>

  /**
   * Set the given Property object as the underlying getter-setter for the specified object property
   */
  setProp<T>(obj: object, name: string, prop: Property<T>): void

  BindingStore: BindingStore

  /**
   * Process data binding directives on `elem` and its descendants, using the provided `context` (value of `this`).
   * The bindings are stored in `bindingStore`, and `debugInfo` is included when errors are logged to the console.
   */
  dataBind: (elem: HTMLElement, context: object, bindingStore: BindingStore, debugInfo: string[]) => void

  /**
   * Perform data binding on the whole document, must be called after DOMContentLoaded
   */
  bindDocument: () => void
}


export interface Property<T> {
  get(): T
  set(newValue: T): void
  subscribe(subscriber: () => void): number
  unsubscribe(subscriptionId: number): void
}

interface BindingStore {
  new()
  unbind(): void
  rebind(): void
}
