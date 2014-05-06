/**
 * ## [new] Blaze.Var(initializer[, equalsFunc])
 *
 * A reactive mutable variable which may be initialized with a value
 * or with a function which is immediately autorun.
 *
 * * `initializer` - A function or a non-function value to use to
 *   initialize the Var.  If a function is given, it is called in
 *   a `Deps.autorun` nested within the current Deps computation.
 *
 * * `equalsFunc` - A comparator function that takes two arguments
 *   and returns a boolean.  The value of the Var is only considered
 *   to have changed (for the purpose of invalidating Computations)
 *   if `equalsFunc(newValue, oldValue)` is truthy.  If `equalsFunc`
 *   is not given, `===` is used.
 *
 * Blaze.Var holds a single reactive value, providing `get` and `set`
 * methods that obey the usual reactive contract of a Deps data
 * source.  (Namely, calling `get` causes the current Computation to
 * depend on the value, and calling `set` invalidates any dependent
 * Computations if it changes the value.)
 *
 * If a function is provided as an initializer, it is called to set
 * the initial value of the Var, and a Computation is started that
 * sets the value of the Var each time it re-runs.  Because this new
 * (inner) Computation is nested in the current (outer) Computation,
 * when the outer Computation is invalidated, the inner Computation
 * is stopped.  A Var whose Computation is stopped continues to be
 * reactively gettable and settable in the usual way.
 *
 * To avoid runaway Vars, an outer Computation is required to create a
 * Var with a function as initializer.  As long as the outer Computation
 * is eventually invalidated or stopped, the Var will eventually
 * stop recomputing its value.
 *
 * Example:
 *
 * ```
var a = Blaze.Var(1);
var b = Blaze.Var(1);

Deps.autorun(function () {
  console.log('LOG:', a.get() + b.get());
});
// => LOG: 2

// These statements are assumed to be typed one at a time
// at the console, giving the autorun a chance to re-run
// between them.
b.set(2); // => LOG: 3
a.set(2); // => LOG: 4
a.set(10), b.set(10); // => LOG: 20 (printed once)
 * ```
 *
 * To use a Var with an initializer function, an outer Computation is necessary
 * and is used to stop the recomputation.
 *
 * Example:
 *
 * ```
var a = Blaze.Var(1);
var b = Blaze.Var(1);

var handle = Deps.autorun(function () { // wrapper Computation
  var c = Blaze.Var(function () {
    return a.get() + b.get();
  });

  Deps.autorun(function () {
    console.log('LOG:', c.get());
  });
});
// => LOG: 2

// These statements are assumed to be typed one at a time
// at the console.
b.set(2); // => LOG: 3
a.set(2); // => LOG: 4
a.set(10), b.set(10); // => LOG: 20 (printed once)
handle.stop();
a.set(1); // nothing printed
 * ```
 *
 * The "wrapper Computation" in the example above is not necessary when
 * writing rendering code in Blaze, which is always invoked in a
 * Computation.
 *
 * As in the above example, the correct place to read a Var is typically
 * from an autorun that exists alongside the Var.  Creating a Var and
 * then getting its value (from the same Computation or an enclosing one)
 * is an antipattern, because when the Var changes, it will trigger its
 * own destruction and (usually) recreation.  While the result may be
 * correct, extra computation and data access will be performed.
 */

Blaze.Var = function (initializer, equalsFunc) {
  var self = this;

  if (! (self instanceof Blaze.Var))
    // called without `new`
    return new Blaze.Var(initializer, equalsFunc);

  self.equalsFunc = equalsFunc;
  self.curValue = null;
  self.inited = false;
  self.dep = new Deps.Dependency;
  self.computation = null;

  if (typeof initializer === 'function') {
    if (! Deps.active)
      throw new Error("Can only create a Blaze.Var(function...) inside a Computation");

    var controller = Blaze.currentController;
    self.computation = Deps.autorun(function (c) {
      Blaze.withCurrentController(controller, function () {
        self.set(initializer());
      });
    });
    Blaze._wrapAutorun(self.computation);
  } else {
    self.set(initializer);
  }
  self.inited = true;
};

_.extend(Blaze.Var.prototype, {
  /**
   * ## Blaze.Var#get()
   *
   * Returns the current value of the Var, causing the current
   * Deps Computation (if any) to depend on the value.
   */
  get: function () {
    if (Deps.active)
      this.dep.depend();

    return this.curValue;
  },
  /**
   * ## Blaze.Var#set(newValue)
   *
   * Sets the current value of the Var, causing any dependent
   * Computations to be invalidated.
   */
  set: function (newValue) {
    var equals = this.equalsFunc;
    var oldValue = this.curValue;

    if (this.inited &&
        (equals ? equals(newValue, oldValue) :
         newValue === oldValue)) {
      // value is same as last time
      return;
    }

    this.curValue = newValue;
    this.dep.changed();
  },
  /**
   * ## Blaze.Var#toString()
   *
   * Returns a String representation of the Var, which
   * includes the string form of its value.
   */
  toString: function () {
    return 'Var{' + this.get() + '}';
  }
});