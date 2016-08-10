import _ from 'utility'
import proxy from './proxy'
import configuration from './configuration'
import logger from './log'

const timeoutframe = _.timeoutframe,
  config = configuration.get()

configuration.register({
  lazy: true,
  animationFrame: true,
  observerKey: '__OBSERVER__',
  expressionKey: '__EXPR_OBSERVER__'
})

const Observer = _.dynamicClass({
  constructor(target) {
    this.target = target
    this.obj = target
    this.listens = {}
    this.changeRecords = {}
    this._notify = this._notify.bind(this)
    this.watchPropNum = 0
    this._init()
  },

  _fire(attr, val, oldVal) {
    let handlers = this.listens[attr]
    if (handlers && (!proxy.eq(val, oldVal) || _.isArray(val)))
      _.each(handlers.slice(), (handler) => {
        handler(attr, val, oldVal, this.target)
      })
  },

  _notify() {
    let obj = this.obj,
      changeRecords = this.changeRecords

    this.request_frame = undefined
    this.changeRecords = {}

    _.each(changeRecords, (val, attr) => {
      this._fire(attr, obj[attr], val)
    })
  },

  _addChangeRecord(attr, oldVal) {
    console.log('add', attr, oldVal)
    if (!config.lazy) {
      this._fire(attr, this.obj[attr], oldVal)
    } else if (!(attr in this.changeRecords)) {
      this.changeRecords[attr] = oldVal
      if (!this.request_frame) {
        this.request_frame = (config.animationFrame ?
          window.requestAnimationFrame(this._notify) :
          timeoutframe.request(this._notify))
      }
    }
  },

  checkHandler(handler) {
    if (!_.isFunc(handler))
      throw TypeError('Invalid Observe Handler')
  },

  hasListen(attr, handler) {
    switch (arguments.length) {
      case 0:
        return !!this.watchPropNum
      case 1:
        if (_.isFunc(attr)) {
          return !_.each(this.listens, (handlers) => {
            return _.lastIndexOf(handlers, attr) !== -1
          })
        }
        return !!this.listens[attr]
      default:
        this.checkHandler(handler)
        return _.lastIndexOf(this.listens[attr], handler) !== -1
    }
  },

  on(attr, handler) {
    let handlers

    this.checkHandler(handler)
    if (!(handlers = this.listens[attr])) {
      this.listens[attr] = [handler]
      this.watchPropNum++;
      this._watch(attr)
    } else {
      handlers.push(handler)
    }
    return this.target
  },

  _cleanListen(attr) {
    this.listens[attr] = undefined
    this.watchPropNum--;
    this._unwatch(attr)
  },

  un(attr, handler) {
    let handlers = this.listens[attr]

    if (handlers) {
      if (arguments.length == 1) {
        this._cleanListen(attr)
      } else {
        this.checkHandler(handler)

        let i = handlers.length
        while (i--) {
          if (handlers[i] === handler) {
            handlers.splice(i, 1)
            if (!handlers.length) this._cleanListen(attr)
            break
          }
        }
      }
    }
    return this.target
  },

  destroy() {
    if (this.request_frame) {
      config.animationFrame ? window.cancelAnimationFrame(this.request_frame) : timeoutframe.cancel(this.request_frame)
      this.request_frame = undefined
    }
    let obj = this.obj
    this._destroy()
    this.obj = undefined
    this.target = undefined
    this.listens = undefined
    this.changeRecords = undefined
    return obj
  },
  _init: _.emptyFunc,
  _destroy: _.emptyFunc,
  _watch: _.emptyFunc,
  _unwatch: _.emptyFunc
})

function hasListen(obj, attr, handler) {
  let observer = _.getOwnProp(obj, config.observerKey)

  return observer ? arguments.length == 1 ? observer.hasListen() :
    arguments.length == 2 ? observer.hasListen(attr) : observer.hasListen(attr, handler) : false
}

function on(obj, attr, handler) {
  let observer = _.getOwnProp(obj, config.observerKey)

  if (!observer) {
    obj = proxy.obj(obj)
    observer = new Observer(obj)
    obj[config.observerKey] = observer
  }
  return observer.on(attr, handler)
}

function un(obj, attr, handler) {
  let observer = _.getOwnProp(obj, config.observerKey)

  if (observer) {
    obj = arguments.length == 2 ? observer.un(attr) : observer.un(attr, handler)
    if (!observer.hasListen()) {
      obj[config.observerKey] = undefined
      return observer.destroy()
    }
  }
  return obj
}

let expressionIdGenerator = 0

const Expression = _.dynamicClass({

  constructor(target, expr, path) {
    this.id = expressionIdGenerator++
      this.expr = expr
    this.handlers = []
    this.observers = []
    this.path = path || _.parseExpr(expr)
    this.observeHandlers = this._initObserveHandlers()
    this.obj = proxy.obj(target)
    this.target = this._observe(this.obj, 0)
    if (proxy.isEnable()) {
      this._onTargetProxy = this._onTargetProxy.bind(this)
      proxy.on(target, this._onTargetProxy)
    }
  },

  _onTargetProxy(obj, proxy) {
    this.target = proxy
  },

  _observe(obj, idx) {
    let prop = this.path[idx],
      o

    if (idx + 1 < this.path.length && (o = obj[prop])) {
      o = this._observe(proxy.obj(o), idx + 1)
      if (proxy.isEnable()) obj[prop] = o
    }
    return on(obj, prop, this.observeHandlers[idx])
  },

  _unobserve(obj, idx) {
    let prop = this.path[idx],
      o,
      ret

    ret = un(obj, prop, this.observeHandlers[idx])
    if (idx + 1 < this.path.length && (o = obj[prop])) {
      o = this._unobserve(proxy.obj(o), idx + 1)
      if (proxy.isEnable()) obj[prop] = o
    }
    return ret
  },

  _initObserveHandlers() {
    return _.map(this.path, function(prop, i) {
      return this._createObserveHandler(i)
    }, this)
  },

  _createObserveHandler(idx) {
    let path = this.path.slice(0, idx + 1),
      rpath = this.path.slice(idx + 1),
      ridx = this.path.length - idx - 1

    return (prop, val, oldVal) => {
      if (ridx) {
        if (oldVal) {
          oldVal = proxy.obj(oldVal)
          this._unobserve(oldVal, idx + 1)
          oldVal = _.get(oldVal, rpath)
        } else {
          oldVal = undefined
        }
        if (val) {
          let mobj = proxy.obj(val),
            obj = this.obj

          val = _.get(mobj, rpath)
          mobj = this._observe(mobj, idx + 1)
          if (true || proxy.isEnable()) {
            // update proxy val
            let i = 0
            while (i < idx) {
              obj = proxy.obj(obj[path[i++]])
              if (!obj) return
            }
            obj[path[i]] = mobj
          }
        } else {
          val = undefined
        }
        if (proxy.eq(val, oldVal))
          return
      }
      _.each(this.handlers.slice(), function(h) {
        h(this.expr, val, oldVal, this.target)
      }, this)
    }
  },
  checkHandler(handler) {
    if (!_.isFunc(handler))
      throw TypeError('Invalid Observe Handler')
  },
  on(handler) {
    this.checkHandler(handler)
    this.handlers.push(handler)
    return this
  },

  un(handler) {
    if (!arguments.length) {
      this.handlers = []
    } else {
      this.checkHandler(handler)

      let handlers = this.handlers,
        i = handlers.length

      while (i--) {
        if (handlers[i] === handler) {
          handlers.splice(i, 1)
          break
        }
      }
    }
    return this
  },

  hasListen(handler) {
    return arguments.length ? _.lastIndexOf(this.handlers, handler) != -1 : !!this.handlers.length
  },

  destory() {
    proxy.un(this.target, this._onTargetProxy)
    let obj = this._unobserve(this.obj, 0)
    this.obj = undefined
    this.target = undefined
    this.expr = undefined
    this.handlers = undefined
    this.path = undefined
    this.observers = undefined
    this.observeHandlers = undefined
    this.target = undefined
    return obj
  }
})


let policies = [],
  policyNames = {}

let inited = false

export default {
  registerPolicy(name, priority, checker, policy) {
      policies.push({
        name: name,
        priority: priority,
        policy: policy,
        checker: checker
      })
      policies.sort((p1, p2) => {
        return p1.priority - p2.priority
      })
      logger.info('register observe policy[%s], priority is %d', name, priority)
      return this
    },
    init(cfg) {
      if (!inited) {
        configuration.config(cfg)
        if (_.each(policies, (policy) => {
            if (policy.checker(config)) {
              _.each(policy.policy(config), (val, key) => {
                Observer.prototype[key] = val
              })
              config.policy = policy.name
              logger.info('apply observe policy[%s], priority is %d', policy.name, policy.priority)
              return false
            }
          }) !== false) throw Error('observer is not supported')
        inited = true
      }
      return this
    },

    on(obj, expr, handler) {
      let path = _.parseExpr(expr)

      if (path.length > 1) {
        let map = _.getOwnProp(obj, config.expressionKey),
          exp = map ? map[expr] : undefined

        if (!exp) {
          exp = new Expression(obj, expr, path)
          if (!map)
            map = obj[config.expressionKey] = {}
          map[expr] = exp
        }
        exp.on(handler)
        return exp.target
      }
      return on(obj, expr, handler)
    },

    un(obj, expr, handler) {
      let path = _.parseExpr(expr)

      if (path.length > 1) {
        let map = _.getOwnProp(obj, config.expressionKey),
          exp = map ? map[expr] : undefined

        if (exp) {
          arguments.length == 2 ? exp.un() : exp.un(handler)
          if (!exp.hasListen()) {
            map[expr] = undefined
            return exp.destory()
          }
          return exp.target
        }
        return proxy.proxy(obj) || obj
      }
      return arguments.length == 2 ? un(obj, expr) : un(obj, expr, handler)
    },

    hasListen(obj, expr, handler) {
      let l = arguments.length

      switch (l) {
        case 1:
          return hasListen(obj)
        case 2:
          if (_.isFunc(expr))
            return hasListen(obj, expr)
      }

      let path = _.parseExpr(expr)

      if (path.length > 1) {
        let map = _.getOwnProp(obj, config.expressionKey),
          exp = map ? map[expr] : undefined

        return exp ? (l == 2 ? true : exp.hasListen(handler)) : false
      }
      return hasListen.apply(window, arguments)
    }
}
