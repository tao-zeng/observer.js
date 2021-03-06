import _ from 'utility'
import logger from './log'

const hasOwn = Object.prototype.hasOwnProperty,
  RESERVE_PROPS = 'hasOwnProperty,isPrototypeOf,propertyIsEnumerable,toLocaleString,toString,valueOf'.split(','),
  RESERVE_ARRAY_PROPS = 'concat,copyWithin,entries,every,fill,filter,find,findIndex,forEach,includes,indexOf,join,keys,lastIndexOf,map,pop,push,reduce,reduceRight,reverse,shift,slice,some,sort,splice,unshift,values'.split(',')

const VBClassFactory = _.dynamicClass({
  constBind: '__VB_CONST__',
  descBind: '__VB_PROXY__',
  classNameGenerator: 0,
  constructor(defProps, onProxyChange) {
    this.classPool = {}
    this.defPropMap = {}
    this.onProxyChange = onProxyChange
    this.addDefProps(defProps)
    this.initConstScript()
  },
  setConstBind(constBind) {
    this.constBind = constBind
    this.initConstScript()
  },
  setDescBind(descBind) {
    this.descBind = descBind
    this.initConstScript()
  },
  addDefProps(defProps) {
    let defPropMap = this.defPropMap,
      props = []

    _.each(defProps || [], (prop) => {
      defPropMap[prop] = true
    })
    for (let prop in defPropMap) {
      if (hasOwn.call(defPropMap, prop))
        props.push(prop)
    }
    this.defProps = props
    logger.info('VBProxy default props is: ', props.join(','))
    this.initReserveProps()
  },
  initReserveProps() {
    this.reserveProps = RESERVE_PROPS.concat(this.defProps)
    this.reserveArrayProps = this.reserveProps.concat(RESERVE_ARRAY_PROPS)
    this.reservePropMap = _.reverseConvert(this.reserveProps)
    this.reserveArrayPropMap = _.reverseConvert(this.reserveArrayProps)
  },
  initConstScript() {
    this.constScript = [
      '\tPublic [', this.descBind, ']\r\n',
      '\tPublic Default Function [', this.constBind, '](desc)\r\n',
      '\t\tset [', this.descBind, '] = desc\r\n',
      '\t\tSet [', this.constBind, '] = Me\r\n',
      '\tEnd Function\r\n'
    ].join('')
  },
  generateClassName() {
    return `VBClass${this.classNameGenerator++}`
  },
  parseClassConstructorName(className) {
    return `${className}Constructor`
  },
  generateSetter(attr) {
    let descBind = this.descBind

    return [
      '\tPublic Property Get [', attr, ']\r\n',
      '\tOn Error Resume Next\r\n',
      '\t\tSet[', attr, '] = [', descBind, '].get("', attr, '")\r\n',
      '\tIf Err.Number <> 0 Then\r\n',
      '\t\t[', attr, '] = [', descBind, '].get("', attr, '")\r\n',
      '\tEnd If\r\n',
      '\tOn Error Goto 0\r\n',
      '\tEnd Property\r\n'
    ]
  },
  generateGetter(attr) {
    let descBind = this.descBind

    return [
      '\tPublic Property Let [', attr, '](val)\r\n',
      '\t\tCall [', descBind, '].set("', attr, '",val)\r\n',
      '\tEnd Property\r\n',
      '\tPublic Property Set [', attr, '](val)\r\n',
      '\t\tCall [', descBind, '].set("', attr, '",val)\r\n',
      '\tEnd Property\r\n',
    ]
  },
  generateClass(className, props, funcMap) {
    let buffer = ['Class ', className, '\r\n', this.constScript, '\r\n']

    _.each(props, (attr) => {
      if (funcMap[attr]) {
        buffer.push('\tPublic [' + attr + ']\r\n')
      } else {
        buffer.push.apply(buffer, this.generateSetter(attr))
        buffer.push.apply(buffer, this.generateGetter(attr))
      }
    })
    buffer.push('End Class\r\n')
    return buffer.join('')
  },
  generateClassConstructor(props, funcMap, funcArray) {
    let key = [props.length, '[', props.join(','), ']', '[', funcArray.join(','), ']'].join(''),
      classConstName = this.classPool[key]

    if (classConstName)
      return classConstName

    let className = this.generateClassName()
    classConstName = this.parseClassConstructorName(className)
    parseVB(this.generateClass(className, props, funcMap))
    parseVB([
      'Function ', classConstName, '(desc)\r\n',
      '\tDim o\r\n',
      '\tSet o = (New ', className, ')(desc)\r\n',
      '\tSet ', classConstName, ' = o\r\n',
      'End Function'
    ].join(''))
    this.classPool[key] = classConstName
    return classConstName
  },
  create(obj, desc) {
    let protoProps,
      protoPropMap,
      props = [],
      funcs = [],
      funcMap = {},
      descBind = this.descBind

    function addProp(prop) {
      if (_.isFunc(obj[prop])) {
        funcMap[prop] = true
        funcs.push(prop)
      }
      props.push(prop)
    }

    if (_.isArray(obj)) {
      protoProps = this.reserveArrayProps
      protoPropMap = this.reserveArrayPropMap
    } else {
      protoProps = this.reserveProps
      protoPropMap = this.reservePropMap
    }
    _.each(protoProps, addProp)
    _.each(obj, (val, prop) => {
      if (prop !== descBind && !(prop in protoPropMap))
        addProp(prop)
    }, obj, false)

    if (!desc) {
      desc = this.descriptor(obj)
      if (desc) {
        obj = desc.obj
      } else {
        desc = new ObjectDescriptor(obj, props, this)
      }
    }

    proxy = window[this.generateClassConstructor(props, funcMap, funcs)](desc)
    desc.proxy = proxy

    _.each(funcs, (prop) => {
      proxy[prop] = this.funcProxy(obj[prop], prop in protoPropMap ? obj : proxy)
    })

    this.onProxyChange(obj, proxy)
    return desc
  },
  funcProxy(fn, scope) {
    return function() {
      return fn.apply(this === window ? scope : this, arguments)
    }
  },
  eq(o1, o2) {
    let d1 = this.descriptor(o1),
      d2 = this.descriptor(o2)

    if (d1) o1 = d1.obj
    if (d2) o2 = d2.obj
    return o1 === o2
  },
  obj(obj) {
    let desc = this.descriptor(obj)

    return desc ? desc.obj : obj
  },
  proxy(obj) {
    let desc = this.descriptor(obj)

    return desc ? desc.proxy : undefined
  },
  isProxy(obj) {
    return hasOwn.call(obj, this.constBind)
  },
  descriptor(obj) {
    let descBind = this.descBind

    return hasOwn.call(obj, descBind) ? obj[descBind] : undefined
  },
  destroy(desc) {
    this.onProxyChange(obj, undefined)
  }
})

const ObjectDescriptor = _.dynamicClass({
  constructor(obj, props, classGenerator) {
    this.classGenerator = classGenerator
    this.obj = obj
    this.defines = _.reverseConvert(props, () => false)
    obj[classGenerator.descBind] = this
    this.accessorNR = 0
  },
  isAccessor(desc) {
    return desc && (desc.get || desc.set)
  },
  hasAccessor() {
    return !!this.accessorNR
  },
  defineProperty(attr, desc) {
    let defines = this.defines,
      obj = this.obj

    if (!(attr in defines)) {
      if (!(attr in obj)) {
        obj[attr] = undefined
      } else if (_.isFunc(obj[attr])) {
        logger.warn('defineProperty not support function [' + attr + ']')
      }
      this.classGenerator.create(this.obj, this)
    }

    if (!this.isAccessor(desc)) {
      if (defines[attr]) {
        defines[attr] = false
        this.accessorNR--;
      }
      obj[attr] = desc.value
    } else {
      defines[attr] = desc
      this.accessorNR++;
      if (desc.get)
        obj[attr] = desc.get()
    }
    return this.proxy
  },
  getPropertyDefine(attr) {
    return this.defines[attr] || undefined
  },
  get(attr) {
    let define = this.defines[attr]

    return define && define.get ? define.get.call(this.proxy) : this.obj[attr]
  },
  set(attr, value) {
    let define = this.defines[attr]

    if (define && define.set) {
      define.set.call(this.proxy, value)
    } else {
      this.obj[attr] = value
    }
  }
})

let supported = undefined
VBClassFactory.isSupport = function isSupport() {
  if (supported !== undefined)
    return supported
  supported = false
  if (window.VBArray) {
    try {
      window.execScript([
        'Function parseVB(code)',
        '\tExecuteGlobal(code)',
        'End Function'
      ].join('\n'), 'VBScript')
      supported = true
    } catch (e) {
      logger.error(e.message, e)
    }
  }
  return supported
}
export default VBClassFactory
