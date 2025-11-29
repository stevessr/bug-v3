!(function (t, e) {
  'object' == typeof exports && 'object' == typeof module
    ? (module.exports = e())
    : 'function' == typeof define && define.amd
      ? define([], e)
      : 'object' == typeof exports
        ? (exports.Live2dRender = e())
        : (t.Live2dRender = e())
    window.Live2dRender = e()
})(self, function () {
  return (function () {
    'use strict'
    var t,
      e,
      i,
      s,
      r,
      a,
      n,
      o = {
        d: function (t, e) {
          for (var i in e)
            o.o(e, i) && !o.o(t, i) && Object.defineProperty(t, i, { enumerable: !0, get: e[i] })
        },
        o: function (t, e) {
          return Object.prototype.hasOwnProperty.call(t, e)
        },
        r: function (t) {
          ;('undefined' != typeof Symbol &&
            Symbol.toStringTag &&
            Object.defineProperty(t, Symbol.toStringTag, { value: 'Module' }),
            Object.defineProperty(t, '__esModule', { value: !0 }))
        }
      },
      l = {}
    ;(o.r(l),
      o.d(l, {
        hideMessageBox: function () {
          return xr
        },
        initializeLive2D: function () {
          return Mr
        },
        revealMessageBox: function () {
          return Cr
        },
        setExpression: function () {
          return fr
        },
        setMessageBox: function () {
          return Sr
        },
        setRandomExpression: function () {
          return yr
        }
      }))
    class u {
      constructor(t = 0) {
        t < 1
          ? ((this._ptr = []), (this._capacity = 0), (this._size = 0))
          : ((this._ptr = new Array(t)), (this._capacity = t), (this._size = 0))
      }
      at(t) {
        return this._ptr[t]
      }
      set(t, e) {
        this._ptr[t] = e
      }
      get(t = 0) {
        const e = new Array()
        for (let i = t; i < this._size; i++) e.push(this._ptr[i])
        return e
      }
      pushBack(t) {
        ;(this._size >= this._capacity &&
          this.prepareCapacity(0 == this._capacity ? u.s_defaultSize : 2 * this._capacity),
          (this._ptr[this._size++] = t))
      }
      clear() {
        ;((this._ptr.length = 0), (this._size = 0))
      }
      getSize() {
        return this._size
      }
      assign(t, e) {
        this._size < t && this.prepareCapacity(t)
        for (let i = 0; i < t; i++) this._ptr[i] = e
        this._size = t
      }
      resize(t, e = null) {
        this.updateSize(t, e, !0)
      }
      updateSize(t, e = null, i = !0) {
        if (this._size < t)
          if ((this.prepareCapacity(t), i))
            for (let i = this._size; i < t; i++)
              this._ptr[i] = 'function' == typeof e ? JSON.parse(JSON.stringify(new e())) : e
          else for (let i = this._size; i < t; i++) this._ptr[i] = e
        else {
          const e = this._size - t
          this._ptr.splice(this._size - e, e)
        }
        this._size = t
      }
      insert(t, e, i) {
        let s = t._index
        const r = e._index,
          a = i._index,
          n = a - r
        this.prepareCapacity(this._size + n)
        const o = this._size - s
        if (o > 0) for (let t = 0; t < o; t++) this._ptr.splice(s + t, 0, null)
        for (let t = r; t < a; t++, s++) this._ptr[s] = e._vector._ptr[t]
        this._size = this._size + n
      }
      remove(t) {
        return !(t < 0 || this._size <= t || (this._ptr.splice(t, 1), --this._size, 0))
      }
      erase(t) {
        const e = t._index
        return e < 0 || this._size <= e ? t : (this._ptr.splice(e, 1), --this._size, new h(this, e))
      }
      prepareCapacity(t) {
        t > this._capacity &&
          (0 == this._capacity
            ? ((this._ptr = new Array(t)), (this._capacity = t))
            : ((this._ptr.length = t), (this._capacity = t)))
      }
      begin() {
        return 0 == this._size ? this.end() : new h(this, 0)
      }
      end() {
        return new h(this, this._size)
      }
      getOffset(t) {
        const e = new u()
        return (
          (e._ptr = this.get(t)),
          (e._size = this.get(t).length),
          (e._capacity = this.get(t).length),
          e
        )
      }
    }
    u.s_defaultSize = 10
    class h {
      constructor(t, e) {
        ;((this._vector = null != t ? t : null), (this._index = null != e ? e : 0))
      }
      set(t) {
        return ((this._index = t._index), (this._vector = t._vector), this)
      }
      preIncrement() {
        return (++this._index, this)
      }
      preDecrement() {
        return (--this._index, this)
      }
      increment() {
        return new h(this._vector, this._index++)
      }
      decrement() {
        return new h(this._vector, this._index--)
      }
      ptr() {
        return this._vector._ptr[this._index]
      }
      substitution(t) {
        return ((this._index = t._index), (this._vector = t._vector), this)
      }
      notEqual(t) {
        return this._index != t._index || this._vector != t._vector
      }
    }
    !(function (t) {
      ;((t.csmVector = u), (t.iterator = h))
    })(t || (t = {}))
    class g {
      append(t, e) {
        return ((this.s += void 0 !== e ? t.substr(0, e) : t), this)
      }
      expansion(t, e) {
        for (let i = 0; i < t; i++) this.append(e)
        return this
      }
      getBytes() {
        return encodeURIComponent(this.s).replace(/%../g, 'x').length
      }
      getLength() {
        return this.s.length
      }
      isLess(t) {
        return this.s < t.s
      }
      isGreat(t) {
        return this.s > t.s
      }
      isEqual(t) {
        return this.s == t
      }
      isEmpty() {
        return 0 == this.s.length
      }
      constructor(t) {
        this.s = t
      }
    }
    !(function (t) {
      t.csmString = g
    })(e || (e = {}))
    class d {
      getString() {
        return this._id
      }
      constructor(t) {
        this._id = 'string' != typeof t ? t : new g(t)
      }
      isEqual(t) {
        return 'string' == typeof t
          ? this._id.isEqual(t)
          : t instanceof g
            ? this._id.isEqual(t.s)
            : t instanceof d && this._id.isEqual(t._id.s)
      }
      isNotEqual(t) {
        return 'string' == typeof t
          ? !this._id.isEqual(t)
          : t instanceof g
            ? !this._id.isEqual(t.s)
            : t instanceof d && !this._id.isEqual(t._id.s)
      }
    }
    !(function (t) {
      t.CubismId = d
    })(i || (i = {}))
    class c {
      constructor() {
        this._ids = new u()
      }
      release() {
        for (let t = 0; t < this._ids.getSize(); ++t) this._ids.set(t, void 0)
        this._ids = null
      }
      registerIds(t) {
        for (let e = 0; e < t.length; e++) this.registerId(t[e])
      }
      registerId(t) {
        let e = null
        return 'string' != typeof t
          ? this.registerId(t.s)
          : (null != (e = this.findId(t)) || ((e = new d(t)), this._ids.pushBack(e)), e)
      }
      getId(t) {
        return this.registerId(t)
      }
      isExist(t) {
        return 'string' == typeof t ? null != this.findId(t) : this.isExist(t.s)
      }
      findId(t) {
        for (let e = 0; e < this._ids.getSize(); ++e)
          if (this._ids.at(e).getString().isEqual(t)) return this._ids.at(e)
        return null
      }
    }
    !(function (t) {
      t.CubismIdManager = c
    })(s || (s = {}))
    class _ {
      constructor() {
        ;((this._tr = new Float32Array(16)), this.loadIdentity())
      }
      static multiply(t, e, i) {
        const s = new Float32Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
        for (let i = 0; i < 4; ++i)
          for (let r = 0; r < 4; ++r)
            for (let a = 0; a < 4; ++a) s[r + 4 * i] += t[a + 4 * i] * e[r + 4 * a]
        for (let t = 0; t < 16; ++t) i[t] = s[t]
      }
      loadIdentity() {
        const t = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
        this.setMatrix(t)
      }
      setMatrix(t) {
        for (let e = 0; e < 16; ++e) this._tr[e] = t[e]
      }
      getArray() {
        return this._tr
      }
      getScaleX() {
        return this._tr[0]
      }
      getScaleY() {
        return this._tr[5]
      }
      getTranslateX() {
        return this._tr[12]
      }
      getTranslateY() {
        return this._tr[13]
      }
      transformX(t) {
        return this._tr[0] * t + this._tr[12]
      }
      transformY(t) {
        return this._tr[5] * t + this._tr[13]
      }
      invertTransformX(t) {
        return (t - this._tr[12]) / this._tr[0]
      }
      invertTransformY(t) {
        return (t - this._tr[13]) / this._tr[5]
      }
      translateRelative(t, e) {
        const i = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, t, e, 0, 1])
        _.multiply(i, this._tr, this._tr)
      }
      translate(t, e) {
        ;((this._tr[12] = t), (this._tr[13] = e))
      }
      translateX(t) {
        this._tr[12] = t
      }
      translateY(t) {
        this._tr[13] = t
      }
      scaleRelative(t, e) {
        const i = new Float32Array([t, 0, 0, 0, 0, e, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
        _.multiply(i, this._tr, this._tr)
      }
      scale(t, e) {
        ;((this._tr[0] = t), (this._tr[5] = e))
      }
      multiplyByMatrix(t) {
        _.multiply(t.getArray(), this._tr, this._tr)
      }
      clone() {
        const t = new _()
        for (let e = 0; e < this._tr.length; e++) t._tr[e] = this._tr[e]
        return t
      }
    }
    !(function (t) {
      t.CubismMatrix44 = _
    })(r || (r = {}))
    class m {
      static create() {
        return null
      }
      static delete(t) {}
      initialize(t) {
        this._model = t
      }
      drawModel() {
        null != this.getModel() && (this.saveProfile(), this.doDrawModel(), this.restoreProfile())
      }
      setMvpMatrix(t) {
        this._mvpMatrix4x4.setMatrix(t.getArray())
      }
      getMvpMatrix() {
        return this._mvpMatrix4x4
      }
      setModelColor(t, e, i, s) {
        ;(t < 0 ? (t = 0) : t > 1 && (t = 1),
          e < 0 ? (e = 0) : e > 1 && (e = 1),
          i < 0 ? (i = 0) : i > 1 && (i = 1),
          s < 0 ? (s = 0) : s > 1 && (s = 1),
          (this._modelColor.R = t),
          (this._modelColor.G = e),
          (this._modelColor.B = i),
          (this._modelColor.A = s))
      }
      getModelColor() {
        return JSON.parse(JSON.stringify(this._modelColor))
      }
      setIsPremultipliedAlpha(t) {
        this._isPremultipliedAlpha = t
      }
      isPremultipliedAlpha() {
        return this._isPremultipliedAlpha
      }
      setIsCulling(t) {
        this._isCulling = t
      }
      isCulling() {
        return this._isCulling
      }
      setAnisotropy(t) {
        this._anisotropy = t
      }
      getAnisotropy() {
        return this._anisotropy
      }
      getModel() {
        return this._model
      }
      useHighPrecisionMask(t) {
        this._useHighPrecisionMask = t
      }
      isUsingHighPrecisionMask() {
        return this._useHighPrecisionMask
      }
      constructor() {
        ;((this._isCulling = !1),
          (this._isPremultipliedAlpha = !1),
          (this._anisotropy = 0),
          (this._model = null),
          (this._modelColor = new p()),
          (this._useHighPrecisionMask = !1),
          (this._mvpMatrix4x4 = new _()),
          this._mvpMatrix4x4.loadIdentity())
      }
    }
    !(function (t) {
      ;((t[(t.CubismBlendMode_Normal = 0)] = 'CubismBlendMode_Normal'),
        (t[(t.CubismBlendMode_Additive = 1)] = 'CubismBlendMode_Additive'),
        (t[(t.CubismBlendMode_Multiplicative = 2)] = 'CubismBlendMode_Multiplicative'))
    })(a || (a = {}))
    class p {
      constructor(t = 1, e = 1, i = 1, s = 1) {
        ;((this.R = t), (this.G = e), (this.B = i), (this.A = s))
      }
    }
    !(function (t) {
      ;((t.CubismBlendMode = a), (t.CubismRenderer = m), (t.CubismTextureColor = p))
    })(n || (n = {}))
    const f = (t, e, i) => {
        ;((t, e, i) => {
          b.print(t, '[CSM]' + e, i)
        })(t, e + '\n', i)
      },
      y = t => {
        console.assert(t)
      }
    let S, x, C, B, M
    ;((S = (t, ...e) => {
      f(Z.LogLevel_Verbose, '[V]' + t, e)
    }),
      (x = (t, ...e) => {
        f(Z.LogLevel_Debug, '[D]' + t, e)
      }),
      (C = (t, ...e) => {
        f(Z.LogLevel_Info, '[I]' + t, e)
      }),
      (B = (t, ...e) => {
        f(Z.LogLevel_Warning, '[W]' + t, e)
      }),
      (M = (t, ...e) => {
        f(Z.LogLevel_Error, '[E]' + t, e)
      }))
    class b {
      static print(t, e, i) {
        if (t < J.getLoggingLevel()) return
        const s = J.coreLogFunction
        s && s(e.replace(/\{(\d+)\}/g, (t, e) => i[e]))
      }
      static dumpBytes(t, e, i) {
        for (let s = 0; s < i; s++)
          (s % 16 == 0 && s > 0 ? this.print(t, '\n') : s % 8 == 0 && s > 0 && this.print(t, '  '),
            this.print(t, '{0} ', [255 & e[s]]))
        this.print(t, '\n')
      }
      constructor() {}
    }
    var P, v
    !(function (t) {
      t.CubismDebug = b
    })(P || (P = {}))
    class w {
      constructor(t, e) {
        ;((this.first = null == t ? null : t), (this.second = null == e ? null : e))
      }
    }
    class I {
      constructor(t) {
        null != t
          ? t < 1
            ? ((this._keyValues = []), (this._dummyValue = null), (this._size = 0))
            : ((this._keyValues = new Array(t)), (this._size = t))
          : ((this._keyValues = []), (this._dummyValue = null), (this._size = 0))
      }
      release() {
        this.clear()
      }
      appendKey(t) {
        ;(this.prepareCapacity(this._size + 1, !1),
          (this._keyValues[this._size] = new w(t)),
          (this._size += 1))
      }
      getValue(t) {
        let e = -1
        for (let i = 0; i < this._size; i++)
          if (this._keyValues[i].first == t) {
            e = i
            break
          }
        return e >= 0
          ? this._keyValues[e].second
          : (this.appendKey(t), this._keyValues[this._size - 1].second)
      }
      setValue(t, e) {
        let i = -1
        for (let e = 0; e < this._size; e++)
          if (this._keyValues[e].first == t) {
            i = e
            break
          }
        i >= 0
          ? (this._keyValues[i].second = e)
          : (this.appendKey(t), (this._keyValues[this._size - 1].second = e))
      }
      isExist(t) {
        for (let e = 0; e < this._size; e++) if (this._keyValues[e].first == t) return !0
        return !1
      }
      clear() {
        ;((this._keyValues = void 0),
          (this._keyValues = null),
          (this._keyValues = []),
          (this._size = 0))
      }
      getSize() {
        return this._size
      }
      prepareCapacity(t, e) {
        t > this._keyValues.length &&
          (0 == this._keyValues.length
            ? (!e && t < I.DefaultSize && (t = I.DefaultSize), (this._keyValues.length = t))
            : (!e && t < 2 * this._keyValues.length && (t = 2 * this._keyValues.length),
              (this._keyValues.length = t)))
      }
      begin() {
        return new T(this, 0)
      }
      end() {
        return new T(this, this._size)
      }
      erase(t) {
        const e = t._index
        return e < 0 || this._size <= e
          ? t
          : (this._keyValues.splice(e, 1), --this._size, new T(this, e))
      }
      dumpAsInt() {
        for (let t = 0; t < this._size; t++) (x('{0} ,', this._keyValues[t]), x('\n'))
      }
    }
    I.DefaultSize = 10
    class T {
      constructor(t, e) {
        ;((this._map = null != t ? t : new I()), (this._index = null != e ? e : 0))
      }
      set(t) {
        return ((this._index = t._index), (this._map = t._map), this)
      }
      preIncrement() {
        return (++this._index, this)
      }
      preDecrement() {
        return (--this._index, this)
      }
      increment() {
        return new T(this._map, this._index++)
      }
      decrement() {
        const t = new T(this._map, this._index)
        return ((this._map = t._map), (this._index = t._index), this)
      }
      ptr() {
        return this._map._keyValues[this._index]
      }
      notEqual(t) {
        return this._index != t._index || this._map != t._map
      }
    }
    !(function (t) {
      ;((t.csmMap = I), (t.csmPair = w), (t.iterator = T))
    })(v || (v = {}))
    class V {
      static parseJsonObject(t, e) {
        return (
          Object.keys(t).forEach(i => {
            if ('boolean' == typeof t[i]) {
              const s = Boolean(t[i])
              e.put(i, new A(s))
            } else if ('string' == typeof t[i]) {
              const s = String(t[i])
              e.put(i, new D(s))
            } else if ('number' == typeof t[i]) {
              const s = Number(t[i])
              e.put(i, new L(s))
            } else
              t[i] instanceof Array
                ? e.put(i, V.parseJsonArray(t[i]))
                : t[i] instanceof Object
                  ? e.put(i, V.parseJsonObject(t[i], new U()))
                  : null == t[i]
                    ? e.put(i, new O())
                    : e.put(i, t[i])
          }),
          e
        )
      }
      static parseJsonArray(t) {
        const e = new N()
        return (
          Object.keys(t).forEach(i => {
            if ('number' == typeof Number(i))
              if ('boolean' == typeof t[i]) {
                const s = Boolean(t[i])
                e.add(new A(s))
              } else if ('string' == typeof t[i]) {
                const s = String(t[i])
                e.add(new D(s))
              } else if ('number' == typeof t[i]) {
                const s = Number(t[i])
                e.add(new L(s))
              } else
                t[i] instanceof Array
                  ? e.add(this.parseJsonArray(t[i]))
                  : t[i] instanceof Object
                    ? e.add(this.parseJsonObject(t[i], new U()))
                    : null == t[i]
                      ? e.add(new O())
                      : e.add(t[i])
            else if (t[i] instanceof Array) e.add(this.parseJsonArray(t[i]))
            else if (t[i] instanceof Object) e.add(this.parseJsonObject(t[i], new U()))
            else if (null == t[i]) e.add(new O())
            else {
              const s = Array(t[i])
              for (let t = 0; t < s.length; t++) e.add(s[t])
            }
          }),
          e
        )
      }
    }
    const R = 'Error: type mismatch'
    class E {
      constructor() {}
      getRawString(t, e) {
        return this.getString(t, e)
      }
      toInt(t = 0) {
        return t
      }
      toFloat(t = 0) {
        return t
      }
      toBoolean(t = !1) {
        return t
      }
      getSize() {
        return 0
      }
      getArray(t = null) {
        return t
      }
      getVector(t = new u()) {
        return t
      }
      getMap(t) {
        return t
      }
      getValueByIndex(t) {
        return E.errorValue.setErrorNotForClientCall(R)
      }
      getValueByString(t) {
        return E.nullValue.setErrorNotForClientCall(R)
      }
      getKeys() {
        return E.s_dummyKeys
      }
      isError() {
        return !1
      }
      isNull() {
        return !1
      }
      isBool() {
        return !1
      }
      isFloat() {
        return !1
      }
      isString() {
        return !1
      }
      isArray() {
        return !1
      }
      isMap() {
        return !1
      }
      equals(t) {
        return !1
      }
      isStatic() {
        return !1
      }
      setErrorNotForClientCall(t) {
        return k.errorValue
      }
      static staticInitializeNotForClientCall() {
        ;((A.trueValue = new A(!0)),
          (A.falseValue = new A(!1)),
          (E.errorValue = new k('ERROR', !0)),
          (E.nullValue = new O()),
          (E.s_dummyKeys = new u()))
      }
      static staticReleaseNotForClientCall() {
        ;((A.trueValue = null),
          (A.falseValue = null),
          (E.errorValue = null),
          (E.nullValue = null),
          (E.s_dummyKeys = null))
      }
    }
    class F {
      constructor(t, e) {
        ;((this._parseCallback = V.parseJsonObject),
          (this._error = null),
          (this._lineCount = 0),
          (this._root = null),
          null != t && this.parseBytes(t, e, this._parseCallback))
      }
      static create(t, e) {
        const i = new F()
        return i.parseBytes(t, e, i._parseCallback) ? i : (F.delete(i), null)
      }
      static delete(t) {}
      getRoot() {
        return this._root
      }
      static arrayBufferToString(t) {
        const e = new Uint8Array(t)
        let i = ''
        for (let t = 0, s = e.length; t < s; ++t) i += '%' + this.pad(e[t].toString(16))
        return ((i = decodeURIComponent(i)), i)
      }
      static pad(t) {
        return t.length < 2 ? '0' + t : t
      }
      parseBytes(t, e, i) {
        const s = new Array(1),
          r = F.arrayBufferToString(t)
        if (
          ((this._root = null == i ? this.parseValue(r, e, 0, s) : i(JSON.parse(r), new U())),
          this._error)
        ) {
          let t = '\0'
          return (
            (t = 'Json parse error : @line ' + (this._lineCount + 1) + '\n'),
            (this._root = new D(t)),
            C('{0}', this._root.getRawString()),
            !1
          )
        }
        return null != this._root || ((this._root = new k(new g(this._error), !1)), !1)
      }
      getParseError() {
        return this._error
      }
      checkEndOfFile() {
        return this._root.getArray()[1].equals('EOF')
      }
      parseValue(t, e, i, s) {
        if (this._error) return null
        let r,
          a = null,
          n = i
        for (; n < e; n++)
          switch (t[n]) {
            case '-':
            case '.':
            case '0':
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
            case '6':
            case '7':
            case '8':
            case '9': {
              const e = new Array(1)
              return ((r = j(t.slice(n), e)), (s[0] = t.indexOf(e[0])), new L(r))
            }
            case '"':
              return new D(this.parseString(t, e, n + 1, s))
            case '[':
              return ((a = this.parseArray(t, e, n + 1, s)), a)
            case '{':
              return ((a = this.parseObject(t, e, n + 1, s)), a)
            case 'n':
              return (n + 3 < e ? ((a = new O()), (s[0] = n + 4)) : (this._error = 'parse null'), a)
            case 't':
              return (
                n + 3 < e ? ((a = A.trueValue), (s[0] = n + 4)) : (this._error = 'parse true'),
                a
              )
            case 'f':
              return (
                n + 4 < e
                  ? ((a = A.falseValue), (s[0] = n + 5))
                  : (this._error = "illegal ',' position"),
                a
              )
            case ',':
              return ((this._error = "illegal ',' position"), null)
            case ']':
              return ((s[0] = n), null)
            case '\n':
              this._lineCount++
          }
        return ((this._error = 'illegal end of value'), null)
      }
      parseString(t, e, i, s) {
        if (this._error) return null
        let r,
          a,
          n = i
        const o = new g('')
        let l = i
        for (; n < e; n++)
          switch (((r = t[n]), r)) {
            case '"':
              return ((s[0] = n + 1), o.append(t.slice(l), n - l), o.s)
            case '//':
              if ((n++, n - 1 > l && o.append(t.slice(l), n - l), (l = n + 1), n < e))
                switch (((a = t[n]), a)) {
                  case '\\':
                    o.expansion(1, '\\')
                    break
                  case '"':
                    o.expansion(1, '"')
                    break
                  case '/':
                    o.expansion(1, '/')
                    break
                  case 'b':
                    o.expansion(1, '\b')
                    break
                  case 'f':
                    o.expansion(1, '\f')
                    break
                  case 'n':
                    o.expansion(1, '\n')
                    break
                  case 'r':
                    o.expansion(1, '\r')
                    break
                  case 't':
                    o.expansion(1, '\t')
                    break
                  case 'u':
                    this._error = 'parse string/unicord escape not supported'
                }
              else this._error = 'parse string/escape error'
          }
        return ((this._error = 'parse string/illegal end'), null)
      }
      parseObject(t, e, i, s) {
        if (this._error) return null
        const r = new U()
        let a = '',
          n = i,
          o = ''
        const l = Array(1)
        let u = !1
        for (; n < e; n++) {
          t: for (; n < e; n++)
            switch (((o = t[n]), o)) {
              case '"':
                if (((a = this.parseString(t, e, n + 1, l)), this._error)) return null
                ;((n = l[0]), (u = !0))
                break t
              case '}':
                return ((s[0] = n + 1), r)
              case ':':
                this._error = "illegal ':' position"
                break
              case '\n':
                this._lineCount++
            }
          if (!u) return ((this._error = 'key not found'), null)
          u = !1
          t: for (; n < e; n++)
            switch (((o = t[n]), o)) {
              case ':':
                ;((u = !0), n++)
                break t
              case '}':
                this._error = "illegal '}' position"
                break
              case '\n':
                this._lineCount++
            }
          if (!u) return ((this._error = "':' not found"), null)
          const i = this.parseValue(t, e, n, l)
          if (this._error) return null
          ;((n = l[0]), r.put(a, i))
          t: for (; n < e; n++)
            switch (((o = t[n]), o)) {
              case ',':
                break t
              case '}':
                return ((s[0] = n + 1), r)
              case '\n':
                this._lineCount++
            }
        }
        return ((this._error = 'illegal end of perseObject'), null)
      }
      parseArray(t, e, i, s) {
        if (this._error) return null
        let r,
          a = new N(),
          n = i
        const o = new Array(1)
        for (; n < e; n++) {
          const i = this.parseValue(t, e, n, o)
          if (this._error) return null
          ;((n = o[0]), i && a.add(i))
          t: for (; n < e; n++)
            switch (((r = t[n]), r)) {
              case ',':
                break t
              case ']':
                return ((s[0] = n + 1), a)
              case '\n':
                ++this._lineCount
            }
        }
        return ((a = void 0), (this._error = 'illegal end of parseObject'), null)
      }
    }
    class L extends E {
      constructor(t) {
        ;(super(), (this._value = t))
      }
      isFloat() {
        return !0
      }
      getString(t, e) {
        return ((this._value = parseFloat('\0')), (this._stringBuffer = '\0'), this._stringBuffer)
      }
      toInt(t = 0) {
        return parseInt(this._value.toString())
      }
      toFloat(t = 0) {
        return this._value
      }
      equals(t) {
        return 'number' == typeof t && !Math.round(t) && t == this._value
      }
    }
    class A extends E {
      isBool() {
        return !0
      }
      toBoolean(t = !1) {
        return this._boolValue
      }
      getString(t, e) {
        return ((this._stringBuffer = this._boolValue ? 'true' : 'false'), this._stringBuffer)
      }
      equals(t) {
        return 'boolean' == typeof t && t == this._boolValue
      }
      isStatic() {
        return !0
      }
      constructor(t) {
        ;(super(), (this._boolValue = t))
      }
    }
    class D extends E {
      constructor(t) {
        ;(super(),
          'string' == typeof t && (this._stringBuffer = t),
          t instanceof g && (this._stringBuffer = t.s))
      }
      isString() {
        return !0
      }
      getString(t, e) {
        return this._stringBuffer
      }
      equals(t) {
        return 'string' == typeof t
          ? this._stringBuffer == t
          : t instanceof g && this._stringBuffer == t.s
      }
    }
    class k extends D {
      isStatic() {
        return this._isStatic
      }
      setErrorNotForClientCall(t) {
        return ((this._stringBuffer = t), this)
      }
      constructor(t, e) {
        ;(super(t), (this._isStatic = e))
      }
      isError() {
        return !0
      }
    }
    class O extends E {
      isNull() {
        return !0
      }
      getString(t, e) {
        return this._stringBuffer
      }
      isStatic() {
        return !0
      }
      setErrorNotForClientCall(t) {
        return ((this._stringBuffer = t), k.nullValue)
      }
      constructor() {
        ;(super(), (this._stringBuffer = 'NullValue'))
      }
    }
    class N extends E {
      constructor() {
        ;(super(), (this._array = new u()))
      }
      release() {
        for (let t = this._array.begin(); t.notEqual(this._array.end()); t.preIncrement()) {
          let e = t.ptr()
          e && !e.isStatic() && ((e = void 0), (e = null))
        }
      }
      isArray() {
        return !0
      }
      getValueByIndex(t) {
        if (t < 0 || this._array.getSize() <= t)
          return E.errorValue.setErrorNotForClientCall('Error: index out of bounds')
        const e = this._array.at(t)
        return null == e ? E.nullValue : e
      }
      getValueByString(t) {
        return E.errorValue.setErrorNotForClientCall(R)
      }
      getString(t, e) {
        const i = e + '[\n'
        for (let t = this._array.begin(); t.notEqual(this._array.end()); t.increment()) {
          const i = t.ptr()
          this._stringBuffer += e + '' + i.getString(e + ' ') + '\n'
        }
        return ((this._stringBuffer = i + e + ']\n'), this._stringBuffer)
      }
      add(t) {
        this._array.pushBack(t)
      }
      getVector(t = null) {
        return this._array
      }
      getSize() {
        return this._array.getSize()
      }
    }
    class U extends E {
      constructor() {
        ;(super(), (this._map = new I()))
      }
      release() {
        const t = this._map.begin()
        for (; t.notEqual(this._map.end()); ) {
          let e = t.ptr().second
          ;(e && !e.isStatic() && ((e = void 0), (e = null)), t.preIncrement())
        }
      }
      isMap() {
        return !0
      }
      getValueByString(t) {
        if (t instanceof g) {
          const e = this._map.getValue(t.s)
          return null == e ? E.nullValue : e
        }
        for (let e = this._map.begin(); e.notEqual(this._map.end()); e.preIncrement())
          if (e.ptr().first == t) return null == e.ptr().second ? E.nullValue : e.ptr().second
        return E.nullValue
      }
      getValueByIndex(t) {
        return E.errorValue.setErrorNotForClientCall(R)
      }
      getString(t, e) {
        this._stringBuffer = e + '{\n'
        const i = this._map.begin()
        for (; i.notEqual(this._map.end()); ) {
          const t = i.ptr().first,
            s = i.ptr().second
          ;((this._stringBuffer += e + ' ' + t + ' : ' + s.getString(e + '   ') + ' \n'),
            i.preIncrement())
        }
        return ((this._stringBuffer += e + '}\n'), this._stringBuffer)
      }
      getMap(t) {
        return this._map
      }
      put(t, e) {
        this._map.setValue(t, e)
      }
      getKeys() {
        if (!this._keys) {
          this._keys = new u()
          const t = this._map.begin()
          for (; t.notEqual(this._map.end()); ) {
            const e = t.ptr().first
            ;(this._keys.pushBack(e), t.preIncrement())
          }
        }
        return this._keys
      }
      getSize() {
        return this._keys.getSize()
      }
    }
    var z
    function j(t, e) {
      let i = 0
      for (let e = 1; ; e++) {
        const s = t.slice(e - 1, e)
        if ('e' == s || '-' == s || 'E' == s) continue
        const r = t.substring(0, e),
          a = Number(r)
        if (isNaN(a)) break
        i = e
      }
      let s = parseFloat(t)
      return (isNaN(s) && (s = NaN), (e[0] = t.slice(i)), s)
    }
    !(function (t) {
      ;((t.CubismJson = F),
        (t.JsonArray = N),
        (t.JsonBoolean = A),
        (t.JsonError = k),
        (t.JsonFloat = L),
        (t.JsonMap = U),
        (t.JsonNullvalue = O),
        (t.JsonString = D),
        (t.Value = E))
    })(z || (z = {}))
    let X = !1,
      G = !1,
      Y = null,
      H = null
    const q = Object.freeze({ vertexOffset: 0, vertexStep: 2 })
    function W(t) {
      t && (t = void 0)
    }
    class J {
      static startUp(t = null) {
        if (X) return (C('CubismFramework.startUp() is already done.'), X)
        if (
          ((Y = t),
          null != Y && Live2DCubismCore.Logging.csmSetLogFunction(Y.logFunction),
          (X = !0),
          X)
        ) {
          const t = Live2DCubismCore.Version.csmGetVersion(),
            e = (16711680 & t) >> 16,
            i = 65535 & t,
            s = t
          C(
            'Live2D Cubism Core version: {0}.{1}.{2} ({3})',
            ('00' + ((4278190080 & t) >> 24)).slice(-2),
            ('00' + e).slice(-2),
            ('0000' + i).slice(-4),
            s
          )
        }
        return (C('CubismFramework.startUp() is complete.'), X)
      }
      static cleanUp() {
        ;((X = !1), (G = !1), (Y = null), (H = null))
      }
      static initialize(t = 0) {
        ;(y(X),
          X
            ? G
              ? B('CubismFramework.initialize() skipped, already initialized.')
              : (E.staticInitializeNotForClientCall(),
                (H = new c()),
                Live2DCubismCore.Memory.initializeAmountOfMemory(t),
                (G = !0),
                C('CubismFramework.initialize() is complete.'))
            : B('CubismFramework is not started.'))
      }
      static dispose() {
        ;(y(X),
          X
            ? G
              ? (E.staticReleaseNotForClientCall(),
                H.release(),
                (H = null),
                m.staticRelease(),
                (G = !1),
                C('CubismFramework.dispose() is complete.'))
              : B('CubismFramework.dispose() skipped, not initialized.')
            : B('CubismFramework is not started.'))
      }
      static isStarted() {
        return X
      }
      static isInitialized() {
        return G
      }
      static coreLogFunction(t) {
        Live2DCubismCore.Logging.csmGetLogFunction() &&
          Live2DCubismCore.Logging.csmGetLogFunction()(t)
      }
      static getLoggingLevel() {
        return null != Y ? Y.loggingLevel : Z.LogLevel_Off
      }
      static getIdManager() {
        return H
      }
      constructor() {}
    }
    class $ {}
    var Z, K
    ;(!(function (t) {
      ;((t[(t.LogLevel_Verbose = 0)] = 'LogLevel_Verbose'),
        (t[(t.LogLevel_Debug = 1)] = 'LogLevel_Debug'),
        (t[(t.LogLevel_Info = 2)] = 'LogLevel_Info'),
        (t[(t.LogLevel_Warning = 3)] = 'LogLevel_Warning'),
        (t[(t.LogLevel_Error = 4)] = 'LogLevel_Error'),
        (t[(t.LogLevel_Off = 5)] = 'LogLevel_Off'))
    })(Z || (Z = {})),
      (function (t) {
        ;((t.Constant = q), (t.csmDelete = W), (t.CubismFramework = J))
      })(K || (K = {})))
    var Q = {
        Canvas: void 0,
        showToolBox: !1,
        CanvasId: 'live2d',
        MessageBoxId: 'live2dMessageBox',
        BackgroundRGBA: [0, 0, 0, 0],
        CanvasSize: 'auto',
        LoadFromCache: !1,
        Live2dDB: void 0,
        ViewScale: 1,
        ViewMaxScale: 2,
        ViewMinScale: 0.8,
        ViewLogicalLeft: -1,
        ViewLogicalRight: 1,
        ViewLogicalBottom: -1,
        ViewLogicalTop: 1,
        ViewLogicalMaxLeft: -2,
        ViewLogicalMaxRight: 2,
        ViewLogicalMaxBottom: -2,
        ViewLogicalMaxTop: 2,
        ResourcesPath: '',
        PowerImageName: '',
        MotionGroupIdle: 'Idle',
        MotionGroupTapBody: 'TapBody',
        HitAreaNameHead: 'Head',
        HitAreaNameBody: 'Body',
        PriorityNone: 0,
        PriorityIdle: 1,
        PriorityNormal: 2,
        PriorityForce: 3,
        MOCConsistencyValidationEnable: !0,
        DebugLogEnable: !0,
        DebugTouchLogEnable: !1,
        CubismLoggingLevel: Z.LogLevel_Verbose,
        RenderTargetWidth: 1900,
        RenderTargetHeight: 1e3
      },
      tt =
        ('undefined' != typeof globalThis && globalThis) ||
        ('undefined' != typeof self && self) ||
        (void 0 !== tt && tt),
      et = 'URLSearchParams' in tt,
      it = 'Symbol' in tt && 'iterator' in Symbol,
      st =
        'FileReader' in tt &&
        'Blob' in tt &&
        (function () {
          try {
            return (new Blob(), !0)
          } catch (t) {
            return !1
          }
        })(),
      rt = 'FormData' in tt,
      at = 'ArrayBuffer' in tt
    if (at)
      var nt = [
          '[object Int8Array]',
          '[object Uint8Array]',
          '[object Uint8ClampedArray]',
          '[object Int16Array]',
          '[object Uint16Array]',
          '[object Int32Array]',
          '[object Uint32Array]',
          '[object Float32Array]',
          '[object Float64Array]'
        ],
        ot =
          ArrayBuffer.isView ||
          function (t) {
            return t && nt.indexOf(Object.prototype.toString.call(t)) > -1
          }
    function lt(t) {
      if (
        ('string' != typeof t && (t = String(t)), /[^a-z0-9\-#$%&'*+.^_`|~!]/i.test(t) || '' === t)
      )
        throw new TypeError('Invalid character in header field name: "' + t + '"')
      return t.toLowerCase()
    }
    function ut(t) {
      return ('string' != typeof t && (t = String(t)), t)
    }
    function ht(t) {
      var e = {
        next: function () {
          var e = t.shift()
          return { done: void 0 === e, value: e }
        }
      }
      return (
        it &&
          (e[Symbol.iterator] = function () {
            return e
          }),
        e
      )
    }
    function gt(t) {
      ;((this.map = {}),
        t instanceof gt
          ? t.forEach(function (t, e) {
              this.append(e, t)
            }, this)
          : Array.isArray(t)
            ? t.forEach(function (t) {
                this.append(t[0], t[1])
              }, this)
            : t &&
              Object.getOwnPropertyNames(t).forEach(function (e) {
                this.append(e, t[e])
              }, this))
    }
    function dt(t) {
      if (t.bodyUsed) return Promise.reject(new TypeError('Already read'))
      t.bodyUsed = !0
    }
    function ct(t) {
      return new Promise(function (e, i) {
        ;((t.onload = function () {
          e(t.result)
        }),
          (t.onerror = function () {
            i(t.error)
          }))
      })
    }
    function _t(t) {
      var e = new FileReader(),
        i = ct(e)
      return (e.readAsArrayBuffer(t), i)
    }
    function mt(t) {
      if (t.slice) return t.slice(0)
      var e = new Uint8Array(t.byteLength)
      return (e.set(new Uint8Array(t)), e.buffer)
    }
    function pt() {
      return (
        (this.bodyUsed = !1),
        (this._initBody = function (t) {
          var e
          ;((this.bodyUsed = this.bodyUsed),
            (this._bodyInit = t),
            t
              ? 'string' == typeof t
                ? (this._bodyText = t)
                : st && Blob.prototype.isPrototypeOf(t)
                  ? (this._bodyBlob = t)
                  : rt && FormData.prototype.isPrototypeOf(t)
                    ? (this._bodyFormData = t)
                    : et && URLSearchParams.prototype.isPrototypeOf(t)
                      ? (this._bodyText = t.toString())
                      : at && st && (e = t) && DataView.prototype.isPrototypeOf(e)
                        ? ((this._bodyArrayBuffer = mt(t.buffer)),
                          (this._bodyInit = new Blob([this._bodyArrayBuffer])))
                        : at && (ArrayBuffer.prototype.isPrototypeOf(t) || ot(t))
                          ? (this._bodyArrayBuffer = mt(t))
                          : (this._bodyText = t = Object.prototype.toString.call(t))
              : (this._bodyText = ''),
            this.headers.get('content-type') ||
              ('string' == typeof t
                ? this.headers.set('content-type', 'text/plain;charset=UTF-8')
                : this._bodyBlob && this._bodyBlob.type
                  ? this.headers.set('content-type', this._bodyBlob.type)
                  : et &&
                    URLSearchParams.prototype.isPrototypeOf(t) &&
                    this.headers.set(
                      'content-type',
                      'application/x-www-form-urlencoded;charset=UTF-8'
                    )))
        }),
        st &&
          ((this.blob = function () {
            var t = dt(this)
            if (t) return t
            if (this._bodyBlob) return Promise.resolve(this._bodyBlob)
            if (this._bodyArrayBuffer) return Promise.resolve(new Blob([this._bodyArrayBuffer]))
            if (this._bodyFormData) throw new Error('could not read FormData body as blob')
            return Promise.resolve(new Blob([this._bodyText]))
          }),
          (this.arrayBuffer = function () {
            return this._bodyArrayBuffer
              ? dt(this) ||
                  (ArrayBuffer.isView(this._bodyArrayBuffer)
                    ? Promise.resolve(
                        this._bodyArrayBuffer.buffer.slice(
                          this._bodyArrayBuffer.byteOffset,
                          this._bodyArrayBuffer.byteOffset + this._bodyArrayBuffer.byteLength
                        )
                      )
                    : Promise.resolve(this._bodyArrayBuffer))
              : this.blob().then(_t)
          })),
        (this.text = function () {
          var t,
            e,
            i,
            s = dt(this)
          if (s) return s
          if (this._bodyBlob)
            return ((t = this._bodyBlob), (i = ct((e = new FileReader()))), e.readAsText(t), i)
          if (this._bodyArrayBuffer)
            return Promise.resolve(
              (function (t) {
                for (var e = new Uint8Array(t), i = new Array(e.length), s = 0; s < e.length; s++)
                  i[s] = String.fromCharCode(e[s])
                return i.join('')
              })(this._bodyArrayBuffer)
            )
          if (this._bodyFormData) throw new Error('could not read FormData body as text')
          return Promise.resolve(this._bodyText)
        }),
        rt &&
          (this.formData = function () {
            return this.text().then(St)
          }),
        (this.json = function () {
          return this.text().then(JSON.parse)
        }),
        this
      )
    }
    ;((gt.prototype.append = function (t, e) {
      ;((t = lt(t)), (e = ut(e)))
      var i = this.map[t]
      this.map[t] = i ? i + ', ' + e : e
    }),
      (gt.prototype.delete = function (t) {
        delete this.map[lt(t)]
      }),
      (gt.prototype.get = function (t) {
        return ((t = lt(t)), this.has(t) ? this.map[t] : null)
      }),
      (gt.prototype.has = function (t) {
        return this.map.hasOwnProperty(lt(t))
      }),
      (gt.prototype.set = function (t, e) {
        this.map[lt(t)] = ut(e)
      }),
      (gt.prototype.forEach = function (t, e) {
        for (var i in this.map) this.map.hasOwnProperty(i) && t.call(e, this.map[i], i, this)
      }),
      (gt.prototype.keys = function () {
        var t = []
        return (
          this.forEach(function (e, i) {
            t.push(i)
          }),
          ht(t)
        )
      }),
      (gt.prototype.values = function () {
        var t = []
        return (
          this.forEach(function (e) {
            t.push(e)
          }),
          ht(t)
        )
      }),
      (gt.prototype.entries = function () {
        var t = []
        return (
          this.forEach(function (e, i) {
            t.push([i, e])
          }),
          ht(t)
        )
      }),
      it && (gt.prototype[Symbol.iterator] = gt.prototype.entries))
    var ft = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT']
    function yt(t, e) {
      if (!(this instanceof yt))
        throw new TypeError(
          'Please use the "new" operator, this DOM object constructor cannot be called as a function.'
        )
      var i,
        s,
        r = (e = e || {}).body
      if (t instanceof yt) {
        if (t.bodyUsed) throw new TypeError('Already read')
        ;((this.url = t.url),
          (this.credentials = t.credentials),
          e.headers || (this.headers = new gt(t.headers)),
          (this.method = t.method),
          (this.mode = t.mode),
          (this.signal = t.signal),
          r || null == t._bodyInit || ((r = t._bodyInit), (t.bodyUsed = !0)))
      } else this.url = String(t)
      if (
        ((this.credentials = e.credentials || this.credentials || 'same-origin'),
        (!e.headers && this.headers) || (this.headers = new gt(e.headers)),
        (this.method =
          ((s = (i = e.method || this.method || 'GET').toUpperCase()), ft.indexOf(s) > -1 ? s : i)),
        (this.mode = e.mode || this.mode || null),
        (this.signal = e.signal || this.signal),
        (this.referrer = null),
        ('GET' === this.method || 'HEAD' === this.method) && r)
      )
        throw new TypeError('Body not allowed for GET or HEAD requests')
      if (
        (this._initBody(r),
        !(
          ('GET' !== this.method && 'HEAD' !== this.method) ||
          ('no-store' !== e.cache && 'no-cache' !== e.cache)
        ))
      ) {
        var a = /([?&])_=[^&]*/
        a.test(this.url)
          ? (this.url = this.url.replace(a, '$1_=' + new Date().getTime()))
          : (this.url += (/\?/.test(this.url) ? '&' : '?') + '_=' + new Date().getTime())
      }
    }
    function St(t) {
      var e = new FormData()
      return (
        t
          .trim()
          .split('&')
          .forEach(function (t) {
            if (t) {
              var i = t.split('='),
                s = i.shift().replace(/\+/g, ' '),
                r = i.join('=').replace(/\+/g, ' ')
              e.append(decodeURIComponent(s), decodeURIComponent(r))
            }
          }),
        e
      )
    }
    function xt(t, e) {
      if (!(this instanceof xt))
        throw new TypeError(
          'Please use the "new" operator, this DOM object constructor cannot be called as a function.'
        )
      ;(e || (e = {}),
        (this.type = 'default'),
        (this.status = void 0 === e.status ? 200 : e.status),
        (this.ok = this.status >= 200 && this.status < 300),
        (this.statusText = void 0 === e.statusText ? '' : '' + e.statusText),
        (this.headers = new gt(e.headers)),
        (this.url = e.url || ''),
        this._initBody(t))
    }
    ;((yt.prototype.clone = function () {
      return new yt(this, { body: this._bodyInit })
    }),
      pt.call(yt.prototype),
      pt.call(xt.prototype),
      (xt.prototype.clone = function () {
        return new xt(this._bodyInit, {
          status: this.status,
          statusText: this.statusText,
          headers: new gt(this.headers),
          url: this.url
        })
      }),
      (xt.error = function () {
        var t = new xt(null, { status: 0, statusText: '' })
        return ((t.type = 'error'), t)
      }))
    var Ct = [301, 302, 303, 307, 308]
    xt.redirect = function (t, e) {
      if (-1 === Ct.indexOf(e)) throw new RangeError('Invalid status code')
      return new xt(null, { status: e, headers: { location: t } })
    }
    var Bt = tt.DOMException
    try {
      new Bt()
    } catch (t) {
      ;(((Bt = function (t, e) {
        ;((this.message = t), (this.name = e))
        var i = Error(t)
        this.stack = i.stack
      }).prototype = Object.create(Error.prototype)),
        (Bt.prototype.constructor = Bt))
    }
    function Mt(t, e) {
      return new Promise(function (i, s) {
        var r = new yt(t, e)
        if (r.signal && r.signal.aborted) return s(new Bt('Aborted', 'AbortError'))
        var a = new XMLHttpRequest()
        function n() {
          a.abort()
        }
        ;((a.onload = function () {
          var t,
            e,
            s = {
              status: a.status,
              statusText: a.statusText,
              headers:
                ((t = a.getAllResponseHeaders() || ''),
                (e = new gt()),
                t
                  .replace(/\r?\n[\t ]+/g, ' ')
                  .split('\r')
                  .map(function (t) {
                    return 0 === t.indexOf('\n') ? t.substr(1, t.length) : t
                  })
                  .forEach(function (t) {
                    var i = t.split(':'),
                      s = i.shift().trim()
                    if (s) {
                      var r = i.join(':').trim()
                      e.append(s, r)
                    }
                  }),
                e)
            }
          s.url = 'responseURL' in a ? a.responseURL : s.headers.get('X-Request-URL')
          var r = 'response' in a ? a.response : a.responseText
          setTimeout(function () {
            i(new xt(r, s))
          }, 0)
        }),
          (a.onerror = function () {
            setTimeout(function () {
              s(new TypeError('Network request failed'))
            }, 0)
          }),
          (a.ontimeout = function () {
            setTimeout(function () {
              s(new TypeError('Network request failed'))
            }, 0)
          }),
          (a.onabort = function () {
            setTimeout(function () {
              s(new Bt('Aborted', 'AbortError'))
            }, 0)
          }),
          a.open(
            r.method,
            (function (t) {
              try {
                return '' === t && tt.location.href ? tt.location.href : t
              } catch (e) {
                return t
              }
            })(r.url),
            !0
          ),
          'include' === r.credentials
            ? (a.withCredentials = !0)
            : 'omit' === r.credentials && (a.withCredentials = !1),
          'responseType' in a &&
            (st
              ? (a.responseType = 'blob')
              : at &&
                r.headers.get('Content-Type') &&
                -1 !== r.headers.get('Content-Type').indexOf('application/octet-stream') &&
                (a.responseType = 'arraybuffer')),
          !e || 'object' != typeof e.headers || e.headers instanceof gt
            ? r.headers.forEach(function (t, e) {
                a.setRequestHeader(e, t)
              })
            : Object.getOwnPropertyNames(e.headers).forEach(function (t) {
                a.setRequestHeader(t, ut(e.headers[t]))
              }),
          r.signal &&
            (r.signal.addEventListener('abort', n),
            (a.onreadystatechange = function () {
              4 === a.readyState && r.signal.removeEventListener('abort', n)
            })),
          a.send(void 0 === r._bodyInit ? null : r._bodyInit))
      })
    }
    ;((Mt.polyfill = !0),
      tt.fetch || ((tt.fetch = Mt), (tt.Headers = gt), (tt.Request = yt), (tt.Response = xt)))
    const bt = Object.freeze({
      HitAreaPrefix: 'HitArea',
      HitAreaHead: 'Head',
      HitAreaBody: 'Body',
      PartsIdCore: 'Parts01Core',
      PartsArmPrefix: 'Parts01Arm_',
      PartsArmLPrefix: 'Parts01ArmL_',
      PartsArmRPrefix: 'Parts01ArmR_',
      ParamAngleX: 'ParamAngleX',
      ParamAngleY: 'ParamAngleY',
      ParamAngleZ: 'ParamAngleZ',
      ParamEyeLOpen: 'ParamEyeLOpen',
      ParamEyeLSmile: 'ParamEyeLSmile',
      ParamEyeROpen: 'ParamEyeROpen',
      ParamEyeRSmile: 'ParamEyeRSmile',
      ParamEyeBallX: 'ParamEyeBallX',
      ParamEyeBallY: 'ParamEyeBallY',
      ParamEyeBallForm: 'ParamEyeBallForm',
      ParamBrowLY: 'ParamBrowLY',
      ParamBrowRY: 'ParamBrowRY',
      ParamBrowLX: 'ParamBrowLX',
      ParamBrowRX: 'ParamBrowRX',
      ParamBrowLAngle: 'ParamBrowLAngle',
      ParamBrowRAngle: 'ParamBrowRAngle',
      ParamBrowLForm: 'ParamBrowLForm',
      ParamBrowRForm: 'ParamBrowRForm',
      ParamMouthForm: 'ParamMouthForm',
      ParamMouthOpenY: 'ParamMouthOpenY',
      ParamCheek: 'ParamCheek',
      ParamBodyAngleX: 'ParamBodyAngleX',
      ParamBodyAngleY: 'ParamBodyAngleY',
      ParamBodyAngleZ: 'ParamBodyAngleZ',
      ParamBreath: 'ParamBreath',
      ParamArmLA: 'ParamArmLA',
      ParamArmRA: 'ParamArmRA',
      ParamArmLB: 'ParamArmLB',
      ParamArmRB: 'ParamArmRB',
      ParamHandL: 'ParamHandL',
      ParamHandR: 'ParamHandR',
      ParamHairFront: 'ParamHairFront',
      ParamHairSide: 'ParamHairSide',
      ParamHairBack: 'ParamHairBack',
      ParamHairFluffy: 'ParamHairFluffy',
      ParamShoulderY: 'ParamShoulderY',
      ParamBustX: 'ParamBustX',
      ParamBustY: 'ParamBustY',
      ParamBaseX: 'ParamBaseX',
      ParamBaseY: 'ParamBaseY',
      ParamNONE: 'NONE:'
    })
    var Pt, vt
    !(function (t) {
      ;((t.HitAreaBody = bt.HitAreaBody),
        (t.HitAreaHead = bt.HitAreaHead),
        (t.HitAreaPrefix = bt.HitAreaPrefix),
        (t.ParamAngleX = bt.ParamAngleX),
        (t.ParamAngleY = bt.ParamAngleY),
        (t.ParamAngleZ = bt.ParamAngleZ),
        (t.ParamArmLA = bt.ParamArmLA),
        (t.ParamArmLB = bt.ParamArmLB),
        (t.ParamArmRA = bt.ParamArmRA),
        (t.ParamArmRB = bt.ParamArmRB),
        (t.ParamBaseX = bt.ParamBaseX),
        (t.ParamBaseY = bt.ParamBaseY),
        (t.ParamBodyAngleX = bt.ParamBodyAngleX),
        (t.ParamBodyAngleY = bt.ParamBodyAngleY),
        (t.ParamBodyAngleZ = bt.ParamBodyAngleZ),
        (t.ParamBreath = bt.ParamBreath),
        (t.ParamBrowLAngle = bt.ParamBrowLAngle),
        (t.ParamBrowLForm = bt.ParamBrowLForm),
        (t.ParamBrowLX = bt.ParamBrowLX),
        (t.ParamBrowLY = bt.ParamBrowLY),
        (t.ParamBrowRAngle = bt.ParamBrowRAngle),
        (t.ParamBrowRForm = bt.ParamBrowRForm),
        (t.ParamBrowRX = bt.ParamBrowRX),
        (t.ParamBrowRY = bt.ParamBrowRY),
        (t.ParamBustX = bt.ParamBustX),
        (t.ParamBustY = bt.ParamBustY),
        (t.ParamCheek = bt.ParamCheek),
        (t.ParamEyeBallForm = bt.ParamEyeBallForm),
        (t.ParamEyeBallX = bt.ParamEyeBallX),
        (t.ParamEyeBallY = bt.ParamEyeBallY),
        (t.ParamEyeLOpen = bt.ParamEyeLOpen),
        (t.ParamEyeLSmile = bt.ParamEyeLSmile),
        (t.ParamEyeROpen = bt.ParamEyeROpen),
        (t.ParamEyeRSmile = bt.ParamEyeRSmile),
        (t.ParamHairBack = bt.ParamHairBack),
        (t.ParamHairFluffy = bt.ParamHairFluffy),
        (t.ParamHairFront = bt.ParamHairFront),
        (t.ParamHairSide = bt.ParamHairSide),
        (t.ParamHandL = bt.ParamHandL),
        (t.ParamHandR = bt.ParamHandR),
        (t.ParamMouthForm = bt.ParamMouthForm),
        (t.ParamMouthOpenY = bt.ParamMouthOpenY),
        (t.ParamNONE = bt.ParamNONE),
        (t.ParamShoulderY = bt.ParamShoulderY),
        (t.PartsArmLPrefix = bt.PartsArmLPrefix),
        (t.PartsArmPrefix = bt.PartsArmPrefix),
        (t.PartsArmRPrefix = bt.PartsArmRPrefix),
        (t.PartsIdCore = bt.PartsIdCore))
    })(Pt || (Pt = {}))
    class wt {}
    !(function (t) {
      t.ICubismModelSetting = wt
    })(vt || (vt = {}))
    const It = 'FileReferences',
      Tt = 'UserData',
      Vt = 'Name',
      Rt = 'File',
      Et = 'Ids',
      Ft = 'Sound',
      Lt = 'FadeInTime',
      At = 'FadeOutTime',
      Dt = 'LipSync',
      kt = 'EyeBlink'
    var Ot, Nt, Ut, zt, jt
    !(function (t) {
      ;((t[(t.FrequestNode_Groups = 0)] = 'FrequestNode_Groups'),
        (t[(t.FrequestNode_Moc = 1)] = 'FrequestNode_Moc'),
        (t[(t.FrequestNode_Motions = 2)] = 'FrequestNode_Motions'),
        (t[(t.FrequestNode_Expressions = 3)] = 'FrequestNode_Expressions'),
        (t[(t.FrequestNode_Textures = 4)] = 'FrequestNode_Textures'),
        (t[(t.FrequestNode_Physics = 5)] = 'FrequestNode_Physics'),
        (t[(t.FrequestNode_Pose = 6)] = 'FrequestNode_Pose'),
        (t[(t.FrequestNode_HitAreas = 7)] = 'FrequestNode_HitAreas'))
    })(Ot || (Ot = {}))
    class Xt extends wt {
      constructor(t, e) {
        ;(super(),
          (this._json = F.create(t, e)),
          this._json &&
            ((this._jsonValue = new u()),
            this._jsonValue.pushBack(this._json.getRoot().getValueByString('Groups')),
            this._jsonValue.pushBack(
              this._json.getRoot().getValueByString(It).getValueByString('Moc')
            ),
            this._jsonValue.pushBack(
              this._json.getRoot().getValueByString(It).getValueByString('Motions')
            ),
            this._jsonValue.pushBack(
              this._json.getRoot().getValueByString(It).getValueByString('Expressions')
            ),
            this._jsonValue.pushBack(
              this._json.getRoot().getValueByString(It).getValueByString('Textures')
            ),
            this._jsonValue.pushBack(
              this._json.getRoot().getValueByString(It).getValueByString('Physics')
            ),
            this._jsonValue.pushBack(
              this._json.getRoot().getValueByString(It).getValueByString('Pose')
            ),
            this._jsonValue.pushBack(this._json.getRoot().getValueByString('HitAreas'))))
      }
      release() {
        ;(F.delete(this._json), (this._jsonValue = null))
      }
      GetJson() {
        return this._json
      }
      getModelFileName() {
        return this.isExistModelFile() ? this._jsonValue.at(Ot.FrequestNode_Moc).getRawString() : ''
      }
      getTextureCount() {
        return this.isExistTextureFiles()
          ? this._jsonValue.at(Ot.FrequestNode_Textures).getSize()
          : 0
      }
      getTextureDirectory() {
        const t = this._jsonValue
            .at(Ot.FrequestNode_Textures)
            .getValueByIndex(0)
            .getRawString()
            .split('/'),
          e = t.length - 1
        let i = ''
        for (let s = 0; s < e; s++) ((i += t[s]), s < e - 1 && (i += '/'))
        return i
      }
      getTextureFileName(t) {
        return this._jsonValue.at(Ot.FrequestNode_Textures).getValueByIndex(t).getRawString()
      }
      getHitAreasCount() {
        return this.isExistHitAreas() ? this._jsonValue.at(Ot.FrequestNode_HitAreas).getSize() : 0
      }
      getHitAreaId(t) {
        return J.getIdManager().getId(
          this._jsonValue
            .at(Ot.FrequestNode_HitAreas)
            .getValueByIndex(t)
            .getValueByString('Id')
            .getRawString()
        )
      }
      getHitAreaName(t) {
        return this._jsonValue
          .at(Ot.FrequestNode_HitAreas)
          .getValueByIndex(t)
          .getValueByString(Vt)
          .getRawString()
      }
      getPhysicsFileName() {
        return this.isExistPhysicsFile()
          ? this._jsonValue.at(Ot.FrequestNode_Physics).getRawString()
          : ''
      }
      getPoseFileName() {
        return this.isExistPoseFile() ? this._jsonValue.at(Ot.FrequestNode_Pose).getRawString() : ''
      }
      getExpressionCount() {
        return this.isExistExpressionFile()
          ? this._jsonValue.at(Ot.FrequestNode_Expressions).getSize()
          : 0
      }
      getExpressionName(t) {
        return this._jsonValue
          .at(Ot.FrequestNode_Expressions)
          .getValueByIndex(t)
          .getValueByString(Vt)
          .getRawString()
      }
      getExpressionFileName(t) {
        return this._jsonValue
          .at(Ot.FrequestNode_Expressions)
          .getValueByIndex(t)
          .getValueByString(Rt)
          .getRawString()
      }
      getMotionGroupCount() {
        return this.isExistMotionGroups()
          ? this._jsonValue.at(Ot.FrequestNode_Motions).getKeys().getSize()
          : 0
      }
      getMotionGroupName(t) {
        return this.isExistMotionGroups()
          ? this._jsonValue.at(Ot.FrequestNode_Motions).getKeys().at(t)
          : null
      }
      getMotionCount(t) {
        return this.isExistMotionGroupName(t)
          ? this._jsonValue.at(Ot.FrequestNode_Motions).getValueByString(t).getSize()
          : 0
      }
      getMotionFileName(t, e) {
        return this.isExistMotionGroupName(t)
          ? this._jsonValue
              .at(Ot.FrequestNode_Motions)
              .getValueByString(t)
              .getValueByIndex(e)
              .getValueByString(Rt)
              .getRawString()
          : ''
      }
      getMotionSoundFileName(t, e) {
        return this.isExistMotionSoundFile(t, e)
          ? this._jsonValue
              .at(Ot.FrequestNode_Motions)
              .getValueByString(t)
              .getValueByIndex(e)
              .getValueByString(Ft)
              .getRawString()
          : ''
      }
      getMotionFadeInTimeValue(t, e) {
        return this.isExistMotionFadeIn(t, e)
          ? this._jsonValue
              .at(Ot.FrequestNode_Motions)
              .getValueByString(t)
              .getValueByIndex(e)
              .getValueByString(Lt)
              .toFloat()
          : -1
      }
      getMotionFadeOutTimeValue(t, e) {
        return this.isExistMotionFadeOut(t, e)
          ? this._jsonValue
              .at(Ot.FrequestNode_Motions)
              .getValueByString(t)
              .getValueByIndex(e)
              .getValueByString(At)
              .toFloat()
          : -1
      }
      getUserDataFile() {
        return this.isExistUserDataFile()
          ? this._json.getRoot().getValueByString(It).getValueByString(Tt).getRawString()
          : ''
      }
      getLayoutMap(t) {
        const e = this._json.getRoot().getValueByString('Layout').getMap()
        if (null == e) return !1
        let i = !1
        for (const s = e.begin(); s.notEqual(e.end()); s.preIncrement())
          (t.setValue(s.ptr().first, s.ptr().second.toFloat()), (i = !0))
        return i
      }
      getEyeBlinkParameterCount() {
        if (!this.isExistEyeBlinkParameters()) return 0
        let t = 0
        for (let e = 0; e < this._jsonValue.at(Ot.FrequestNode_Groups).getSize(); e++) {
          const i = this._jsonValue.at(Ot.FrequestNode_Groups).getValueByIndex(e)
          if (!i.isNull() && !i.isError() && i.getValueByString(Vt).getRawString() == kt) {
            t = i.getValueByString(Et).getVector().getSize()
            break
          }
        }
        return t
      }
      getEyeBlinkParameterId(t) {
        if (!this.isExistEyeBlinkParameters()) return null
        for (let e = 0; e < this._jsonValue.at(Ot.FrequestNode_Groups).getSize(); e++) {
          const i = this._jsonValue.at(Ot.FrequestNode_Groups).getValueByIndex(e)
          if (!i.isNull() && !i.isError() && i.getValueByString(Vt).getRawString() == kt)
            return J.getIdManager().getId(i.getValueByString(Et).getValueByIndex(t).getRawString())
        }
        return null
      }
      getLipSyncParameterCount() {
        if (!this.isExistLipSyncParameters()) return 0
        let t = 0
        for (let e = 0; e < this._jsonValue.at(Ot.FrequestNode_Groups).getSize(); e++) {
          const i = this._jsonValue.at(Ot.FrequestNode_Groups).getValueByIndex(e)
          if (!i.isNull() && !i.isError() && i.getValueByString(Vt).getRawString() == Dt) {
            t = i.getValueByString(Et).getVector().getSize()
            break
          }
        }
        return t
      }
      getLipSyncParameterId(t) {
        if (!this.isExistLipSyncParameters()) return null
        for (let e = 0; e < this._jsonValue.at(Ot.FrequestNode_Groups).getSize(); e++) {
          const i = this._jsonValue.at(Ot.FrequestNode_Groups).getValueByIndex(e)
          if (!i.isNull() && !i.isError() && i.getValueByString(Vt).getRawString() == Dt)
            return J.getIdManager().getId(i.getValueByString(Et).getValueByIndex(t).getRawString())
        }
        return null
      }
      isExistModelFile() {
        const t = this._jsonValue.at(Ot.FrequestNode_Moc)
        return !t.isNull() && !t.isError()
      }
      isExistTextureFiles() {
        const t = this._jsonValue.at(Ot.FrequestNode_Textures)
        return !t.isNull() && !t.isError()
      }
      isExistHitAreas() {
        const t = this._jsonValue.at(Ot.FrequestNode_HitAreas)
        return !t.isNull() && !t.isError()
      }
      isExistPhysicsFile() {
        const t = this._jsonValue.at(Ot.FrequestNode_Physics)
        return !t.isNull() && !t.isError()
      }
      isExistPoseFile() {
        const t = this._jsonValue.at(Ot.FrequestNode_Pose)
        return !t.isNull() && !t.isError()
      }
      isExistExpressionFile() {
        const t = this._jsonValue.at(Ot.FrequestNode_Expressions)
        return !t.isNull() && !t.isError()
      }
      isExistMotionGroups() {
        const t = this._jsonValue.at(Ot.FrequestNode_Motions)
        return !t.isNull() && !t.isError()
      }
      isExistMotionGroupName(t) {
        const e = this._jsonValue.at(Ot.FrequestNode_Motions).getValueByString(t)
        return !e.isNull() && !e.isError()
      }
      isExistMotionSoundFile(t, e) {
        const i = this._jsonValue
          .at(Ot.FrequestNode_Motions)
          .getValueByString(t)
          .getValueByIndex(e)
          .getValueByString(Ft)
        return !i.isNull() && !i.isError()
      }
      isExistMotionFadeIn(t, e) {
        const i = this._jsonValue
          .at(Ot.FrequestNode_Motions)
          .getValueByString(t)
          .getValueByIndex(e)
          .getValueByString(Lt)
        return !i.isNull() && !i.isError()
      }
      isExistMotionFadeOut(t, e) {
        const i = this._jsonValue
          .at(Ot.FrequestNode_Motions)
          .getValueByString(t)
          .getValueByIndex(e)
          .getValueByString(At)
        return !i.isNull() && !i.isError()
      }
      isExistUserDataFile() {
        const t = this._json.getRoot().getValueByString(It).getValueByString(Tt)
        return !t.isNull() && !t.isError()
      }
      isExistEyeBlinkParameters() {
        if (
          this._jsonValue.at(Ot.FrequestNode_Groups).isNull() ||
          this._jsonValue.at(Ot.FrequestNode_Groups).isError()
        )
          return !1
        for (let t = 0; t < this._jsonValue.at(Ot.FrequestNode_Groups).getSize(); ++t)
          if (
            this._jsonValue
              .at(Ot.FrequestNode_Groups)
              .getValueByIndex(t)
              .getValueByString(Vt)
              .getRawString() == kt
          )
            return !0
        return !1
      }
      isExistLipSyncParameters() {
        if (
          this._jsonValue.at(Ot.FrequestNode_Groups).isNull() ||
          this._jsonValue.at(Ot.FrequestNode_Groups).isError()
        )
          return !1
        for (let t = 0; t < this._jsonValue.at(Ot.FrequestNode_Groups).getSize(); ++t)
          if (
            this._jsonValue
              .at(Ot.FrequestNode_Groups)
              .getValueByIndex(t)
              .getValueByString(Vt)
              .getRawString() == Dt
          )
            return !0
        return !1
      }
    }
    !(function (t) {
      t.CubismModelSettingJson = Xt
    })(Nt || (Nt = {}))
    class Gt {
      static create() {
        return new Gt()
      }
      static delete(t) {
        null != t && (t = null)
      }
      setParameters(t) {
        this._breathParameters = t
      }
      getParameters() {
        return this._breathParameters
      }
      updateParameters(t, e) {
        this._currentTime += e
        const i = 2 * this._currentTime * 3.14159
        for (let e = 0; e < this._breathParameters.getSize(); ++e) {
          const s = this._breathParameters.at(e)
          t.addParameterValueById(
            s.parameterId,
            s.offset + s.peak * Math.sin(i / s.cycle),
            s.weight
          )
        }
      }
      constructor() {
        this._currentTime = 0
      }
    }
    class Yt {
      constructor(t, e, i, s, r) {
        ;((this.parameterId = null == t ? null : t),
          (this.offset = null == e ? 0 : e),
          (this.peak = null == i ? 0 : i),
          (this.cycle = null == s ? 0 : s),
          (this.weight = null == r ? 0 : r))
      }
    }
    !(function (t) {
      ;((t.BreathParameterData = Yt), (t.CubismBreath = Gt))
    })(Ut || (Ut = {}))
    class Ht {
      static create(t = null) {
        return new Ht(t)
      }
      static delete(t) {
        null != t && (t = null)
      }
      setBlinkingInterval(t) {
        this._blinkingIntervalSeconds = t
      }
      setBlinkingSetting(t, e, i) {
        ;((this._closingSeconds = t), (this._closedSeconds = e), (this._openingSeconds = i))
      }
      setParameterIds(t) {
        this._parameterIds = t
      }
      getParameterIds() {
        return this._parameterIds
      }
      updateParameters(t, e) {
        let i
        this._userTimeSeconds += e
        let s = 0
        switch (this._blinkingState) {
          case zt.EyeState_Closing:
            ;((s = (this._userTimeSeconds - this._stateStartTimeSeconds) / this._closingSeconds),
              s >= 1 &&
                ((s = 1),
                (this._blinkingState = zt.EyeState_Closed),
                (this._stateStartTimeSeconds = this._userTimeSeconds)),
              (i = 1 - s))
            break
          case zt.EyeState_Closed:
            ;((s = (this._userTimeSeconds - this._stateStartTimeSeconds) / this._closedSeconds),
              s >= 1 &&
                ((this._blinkingState = zt.EyeState_Opening),
                (this._stateStartTimeSeconds = this._userTimeSeconds)),
              (i = 0))
            break
          case zt.EyeState_Opening:
            ;((s = (this._userTimeSeconds - this._stateStartTimeSeconds) / this._openingSeconds),
              s >= 1 &&
                ((s = 1),
                (this._blinkingState = zt.EyeState_Interval),
                (this._nextBlinkingTime = this.determinNextBlinkingTiming())),
              (i = s))
            break
          case zt.EyeState_Interval:
            ;(this._nextBlinkingTime < this._userTimeSeconds &&
              ((this._blinkingState = zt.EyeState_Closing),
              (this._stateStartTimeSeconds = this._userTimeSeconds)),
              (i = 1))
            break
          case zt.EyeState_First:
          default:
            ;((this._blinkingState = zt.EyeState_Interval),
              (this._nextBlinkingTime = this.determinNextBlinkingTiming()),
              (i = 1))
        }
        Ht.CloseIfZero || (i = -i)
        for (let e = 0; e < this._parameterIds.getSize(); ++e)
          t.setParameterValueById(this._parameterIds.at(e), i)
      }
      constructor(t) {
        if (
          ((this._blinkingState = zt.EyeState_First),
          (this._nextBlinkingTime = 0),
          (this._stateStartTimeSeconds = 0),
          (this._blinkingIntervalSeconds = 4),
          (this._closingSeconds = 0.1),
          (this._closedSeconds = 0.05),
          (this._openingSeconds = 0.15),
          (this._userTimeSeconds = 0),
          (this._parameterIds = new u()),
          null != t)
        )
          for (let e = 0; e < t.getEyeBlinkParameterCount(); ++e)
            this._parameterIds.pushBack(t.getEyeBlinkParameterId(e))
      }
      determinNextBlinkingTiming() {
        const t = Math.random()
        return this._userTimeSeconds + t * (2 * this._blinkingIntervalSeconds - 1)
      }
    }
    ;((Ht.CloseIfZero = !0),
      (function (t) {
        ;((t[(t.EyeState_First = 0)] = 'EyeState_First'),
          (t[(t.EyeState_Interval = 1)] = 'EyeState_Interval'),
          (t[(t.EyeState_Closing = 2)] = 'EyeState_Closing'),
          (t[(t.EyeState_Closed = 3)] = 'EyeState_Closed'),
          (t[(t.EyeState_Opening = 4)] = 'EyeState_Opening'))
      })(zt || (zt = {})),
      (function (t) {
        ;((t.CubismEyeBlink = Ht), (t.EyeState = zt))
      })(jt || (jt = {})))
    const qt = 'FadeInTime',
      Wt = 'Link'
    class Jt {
      static create(t, e) {
        const i = new Jt(),
          s = F.create(t, e),
          r = s.getRoot()
        r.getValueByString(qt).isNull() ||
          ((i._fadeTimeSeconds = r.getValueByString(qt).toFloat(0.5)),
          i._fadeTimeSeconds <= 0 && (i._fadeTimeSeconds = 0.5))
        const a = r.getValueByString('Groups'),
          n = a.getSize()
        for (let t = 0; t < n; ++t) {
          const e = a.getValueByIndex(t),
            s = e.getSize()
          let r = 0
          for (let t = 0; t < s; ++t) {
            const s = e.getValueByIndex(t),
              a = new $t(),
              n = J.getIdManager().getId(s.getValueByString('Id').getRawString())
            if (((a.partId = n), !s.getValueByString(Wt).isNull())) {
              const t = s.getValueByString(Wt),
                e = t.getSize()
              for (let i = 0; i < e; ++i) {
                const e = new $t(),
                  s = J.getIdManager().getId(t.getValueByIndex(i).getString())
                ;((e.partId = s), a.link.pushBack(e))
              }
            }
            ;(i._partGroups.pushBack(a.clone()), ++r)
          }
          i._partGroupCounts.pushBack(r)
        }
        return (F.delete(s), i)
      }
      static delete(t) {
        null != t && (t = null)
      }
      updateParameters(t, e) {
        ;(t != this._lastModel && this.reset(t), (this._lastModel = t), e < 0 && (e = 0))
        let i = 0
        for (let s = 0; s < this._partGroupCounts.getSize(); s++) {
          const r = this._partGroupCounts.at(s)
          ;(this.doFade(t, e, i, r), (i += r))
        }
        this.copyPartOpacities(t)
      }
      reset(t) {
        let e = 0
        for (let i = 0; i < this._partGroupCounts.getSize(); ++i) {
          const s = this._partGroupCounts.at(i)
          for (let i = e; i < e + s; ++i) {
            this._partGroups.at(i).initialize(t)
            const s = this._partGroups.at(i).partIndex,
              r = this._partGroups.at(i).parameterIndex
            if (!(s < 0)) {
              ;(t.setPartOpacityByIndex(s, i == e ? 1 : 0),
                t.setParameterValueByIndex(r, i == e ? 1 : 0))
              for (let e = 0; e < this._partGroups.at(i).link.getSize(); ++e)
                this._partGroups.at(i).link.at(e).initialize(t)
            }
          }
          e += s
        }
      }
      copyPartOpacities(t) {
        for (let e = 0; e < this._partGroups.getSize(); ++e) {
          const i = this._partGroups.at(e)
          if (0 == i.link.getSize()) continue
          const s = this._partGroups.at(e).partIndex,
            r = t.getPartOpacityByIndex(s)
          for (let e = 0; e < i.link.getSize(); ++e) {
            const s = i.link.at(e).partIndex
            s < 0 || t.setPartOpacityByIndex(s, r)
          }
        }
      }
      doFade(t, e, i, s) {
        let r = -1,
          a = 1
        for (let n = i; n < i + s; ++n) {
          const i = this._partGroups.at(n).partIndex,
            s = this._partGroups.at(n).parameterIndex
          if (t.getParameterValueByIndex(s) > 0.001) {
            if (r >= 0) break
            ;((r = n),
              (a = t.getPartOpacityByIndex(i)),
              (a += e / this._fadeTimeSeconds),
              a > 1 && (a = 1))
          }
        }
        r < 0 && ((r = 0), (a = 1))
        for (let e = i; e < i + s; ++e) {
          const i = this._partGroups.at(e).partIndex
          if (r == e) t.setPartOpacityByIndex(i, a)
          else {
            let e,
              s = t.getPartOpacityByIndex(i)
            ;((e = a < 0.5 ? (-0.5 * a) / 0.5 + 1 : (0.5 * (1 - a)) / 0.5),
              (1 - e) * (1 - a) > 0.15 && (e = 1 - 0.15 / (1 - a)),
              s > e && (s = e),
              t.setPartOpacityByIndex(i, s))
          }
        }
      }
      constructor() {
        ;((this._fadeTimeSeconds = 0.5),
          (this._lastModel = null),
          (this._partGroups = new u()),
          (this._partGroupCounts = new u()))
      }
    }
    class $t {
      constructor(t) {
        if (((this.parameterIndex = 0), (this.partIndex = 0), (this.link = new u()), null != t)) {
          this.partId = t.partId
          for (const e = t.link.begin(); e.notEqual(t.link.end()); e.preIncrement())
            this.link.pushBack(e.ptr().clone())
        }
      }
      assignment(t) {
        this.partId = t.partId
        for (const e = t.link.begin(); e.notEqual(t.link.end()); e.preIncrement())
          this.link.pushBack(e.ptr().clone())
        return this
      }
      initialize(t) {
        ;((this.parameterIndex = t.getParameterIndex(this.partId)),
          (this.partIndex = t.getPartIndex(this.partId)),
          t.setParameterValueByIndex(this.parameterIndex, 1))
      }
      clone() {
        const t = new $t()
        ;((t.partId = this.partId),
          (t.parameterIndex = this.parameterIndex),
          (t.partIndex = this.partIndex),
          (t.link = new u()))
        for (let e = this.link.begin(); e.notEqual(this.link.end()); e.increment())
          t.link.pushBack(e.ptr().clone())
        return t
      }
    }
    var Zt, Kt, Qt, te, ee, ie
    !(function (t) {
      ;((t.CubismPose = Jt), (t.PartData = $t))
    })(Zt || (Zt = {}))
    class se extends _ {
      constructor(t, e) {
        ;(super(),
          (this._width = void 0 !== t ? t : 0),
          (this._height = void 0 !== e ? e : 0),
          this.setHeight(2))
      }
      setWidth(t) {
        const e = t / this._width,
          i = e
        this.scale(e, i)
      }
      setHeight(t) {
        const e = t / this._height,
          i = e
        this.scale(e, i)
      }
      setPosition(t, e) {
        this.translate(t, e)
      }
      setCenterPosition(t, e) {
        ;(this.centerX(t), this.centerY(e))
      }
      top(t) {
        this.setY(t)
      }
      bottom(t) {
        const e = this._height * this.getScaleY()
        this.translateY(t - e)
      }
      left(t) {
        this.setX(t)
      }
      right(t) {
        const e = this._width * this.getScaleX()
        this.translateX(t - e)
      }
      centerX(t) {
        const e = this._width * this.getScaleX()
        this.translateX(t - e / 2)
      }
      setX(t) {
        this.translateX(t)
      }
      centerY(t) {
        const e = this._height * this.getScaleY()
        this.translateY(t - e / 2)
      }
      setY(t) {
        this.translateY(t)
      }
      setupFromLayout(t) {
        for (const e = t.begin(); e.notEqual(t.end()); e.preIncrement()) {
          const t = e.ptr().first,
            i = e.ptr().second
          'width' == t ? this.setWidth(i) : 'height' == t && this.setHeight(i)
        }
        for (const e = t.begin(); e.notEqual(t.end()); e.preIncrement()) {
          const t = e.ptr().first,
            i = e.ptr().second
          'x' == t
            ? this.setX(i)
            : 'y' == t
              ? this.setY(i)
              : 'center_x' == t
                ? this.centerX(i)
                : 'center_y' == t
                  ? this.centerY(i)
                  : 'top' == t
                    ? this.top(i)
                    : 'bottom' == t
                      ? this.bottom(i)
                      : 'left' == t
                        ? this.left(i)
                        : 'right' == t && this.right(i)
        }
      }
    }
    !(function (t) {
      t.CubismModelMatrix = se
    })(Kt || (Kt = {}))
    class re {
      constructor(t, e) {
        ;((this.x = t), (this.y = e), (this.x = null == t ? 0 : t), (this.y = null == e ? 0 : e))
      }
      add(t) {
        const e = new re(0, 0)
        return ((e.x = this.x + t.x), (e.y = this.y + t.y), e)
      }
      substract(t) {
        const e = new re(0, 0)
        return ((e.x = this.x - t.x), (e.y = this.y - t.y), e)
      }
      multiply(t) {
        const e = new re(0, 0)
        return ((e.x = this.x * t.x), (e.y = this.y * t.y), e)
      }
      multiplyByScaler(t) {
        return this.multiply(new re(t, t))
      }
      division(t) {
        const e = new re(0, 0)
        return ((e.x = this.x / t.x), (e.y = this.y / t.y), e)
      }
      divisionByScalar(t) {
        return this.division(new re(t, t))
      }
      getLength() {
        return Math.sqrt(this.x * this.x + this.y * this.y)
      }
      getDistanceWith(t) {
        return Math.sqrt((this.x - t.x) * (this.x - t.x) + (this.y - t.y) * (this.y - t.y))
      }
      dot(t) {
        return this.x * t.x + this.y * t.y
      }
      normalize() {
        const t = Math.pow(this.x * this.x + this.y * this.y, 0.5)
        ;((this.x = this.x / t), (this.y = this.y / t))
      }
      isEqual(t) {
        return this.x == t.x && this.y == t.y
      }
      isNotEqual(t) {
        return !this.isEqual(t)
      }
    }
    !(function (t) {
      t.CubismVector2 = re
    })(Qt || (Qt = {}))
    class ae {
      static range(t, e, i) {
        return (t < e ? (t = e) : t > i && (t = i), t)
      }
      static sin(t) {
        return Math.sin(t)
      }
      static cos(t) {
        return Math.cos(t)
      }
      static abs(t) {
        return Math.abs(t)
      }
      static sqrt(t) {
        return Math.sqrt(t)
      }
      static cbrt(t) {
        if (0 === t) return t
        let e = t
        const i = e < 0
        let s
        return (
          i && (e = -e),
          e === 1 / 0
            ? (s = 1 / 0)
            : ((s = Math.exp(Math.log(e) / 3)), (s = (e / (s * s) + 2 * s) / 3)),
          i ? -s : s
        )
      }
      static getEasingSine(t) {
        return t < 0 ? 0 : t > 1 ? 1 : 0.5 - 0.5 * this.cos(t * Math.PI)
      }
      static max(t, e) {
        return t > e ? t : e
      }
      static min(t, e) {
        return t > e ? e : t
      }
      static degreesToRadian(t) {
        return (t / 180) * Math.PI
      }
      static radianToDegrees(t) {
        return (180 * t) / Math.PI
      }
      static directionToRadian(t, e) {
        let i = Math.atan2(e.y, e.x) - Math.atan2(t.y, t.x)
        for (; i < -Math.PI; ) i += 2 * Math.PI
        for (; i > Math.PI; ) i -= 2 * Math.PI
        return i
      }
      static directionToDegrees(t, e) {
        const i = this.directionToRadian(t, e)
        let s = this.radianToDegrees(i)
        return (e.x - t.x > 0 && (s = -s), s)
      }
      static radianToDirection(t) {
        const e = new re()
        return ((e.x = this.sin(t)), (e.y = this.cos(t)), e)
      }
      static quadraticEquation(t, e, i) {
        return this.abs(t) < ae.Epsilon
          ? this.abs(e) < ae.Epsilon
            ? -i
            : -i / e
          : -(e + this.sqrt(e * e - 4 * t * i)) / (2 * t)
      }
      static cardanoAlgorithmForBezier(t, e, i, s) {
        if (this.sqrt(t) < ae.Epsilon) return this.range(this.quadraticEquation(e, i, s), 0, 1)
        const r = e / t,
          a = i / t,
          n = (3 * a - r * r) / 3,
          o = n / 3,
          l = (2 * r * r * r - 9 * r * a + (s / t) * 27) / 27,
          u = l / 2,
          h = u * u + o * o * o,
          g = 0.51
        if (h < 0) {
          const t = -n / 3,
            e = t * t * t,
            i = this.sqrt(e),
            s = -l / (2 * i),
            a = this.range(s, -1, 1),
            o = Math.acos(a),
            u = 2 * this.cbrt(i),
            h = u * this.cos(o / 3) - r / 3
          if (this.abs(h - 0.5) < g) return this.range(h, 0, 1)
          const d = u * this.cos((o + 2 * Math.PI) / 3) - r / 3
          if (this.abs(d - 0.5) < g) return this.range(d, 0, 1)
          const c = u * this.cos((o + 4 * Math.PI) / 3) - r / 3
          return this.range(c, 0, 1)
        }
        if (0 == h) {
          let t
          t = u < 0 ? this.cbrt(-u) : -this.cbrt(u)
          const e = 2 * t - r / 3
          if (this.abs(e - 0.5) < g) return this.range(e, 0, 1)
          const i = -t - r / 3
          return this.range(i, 0, 1)
        }
        const d = this.sqrt(h),
          c = this.cbrt(d - u) - this.cbrt(d + u) - r / 3
        return this.range(c, 0, 1)
      }
      constructor() {}
    }
    ;((ae.Epsilon = 1e-5),
      (function (t) {
        t.CubismMath = ae
      })(te || (te = {})))
    class ne {
      constructor() {
        ;((this._faceTargetX = 0),
          (this._faceTargetY = 0),
          (this._faceX = 0),
          (this._faceY = 0),
          (this._faceVX = 0),
          (this._faceVY = 0),
          (this._lastTimeSeconds = 0),
          (this._userTimeSeconds = 0))
      }
      update(t) {
        this._userTimeSeconds += t
        const e = 4 / 30
        if (0 == this._lastTimeSeconds) return void (this._lastTimeSeconds = this._userTimeSeconds)
        const i = 30 * (this._userTimeSeconds - this._lastTimeSeconds)
        this._lastTimeSeconds = this._userTimeSeconds
        const s = (i * e) / 4.5,
          r = this._faceTargetX - this._faceX,
          a = this._faceTargetY - this._faceY
        if (ae.abs(r) <= 0.01 && ae.abs(a) <= 0.01) return
        const n = ae.sqrt(r * r + a * a),
          o = (e * a) / n
        let l = (e * r) / n - this._faceVX,
          u = o - this._faceVY
        const h = ae.sqrt(l * l + u * u)
        ;((h < -s || h > s) && ((l *= s / h), (u *= s / h)),
          (this._faceVX += l),
          (this._faceVY += u))
        {
          const t = 0.5 * (ae.sqrt(s * s + 16 * s * n - 8 * s * n) - s),
            e = ae.sqrt(this._faceVX * this._faceVX + this._faceVY * this._faceVY)
          e > t && ((this._faceVX *= t / e), (this._faceVY *= t / e))
        }
        ;((this._faceX += this._faceVX), (this._faceY += this._faceVY))
      }
      getX() {
        return this._faceX
      }
      getY() {
        return this._faceY
      }
      set(t, e) {
        ;((this._faceTargetX = t), (this._faceTargetY = e))
      }
    }
    !(function (t) {
      t.CubismTargetPoint = ne
    })(ee || (ee = {}))
    class oe {
      static delete(t) {
        ;(t.release(), (t = null))
      }
      constructor() {
        ;((this.setFinishedMotionHandler = t => (this._onFinishedMotion = t)),
          (this.getFinishedMotionHandler = () => this._onFinishedMotion),
          (this._fadeInSeconds = -1),
          (this._fadeOutSeconds = -1),
          (this._weight = 1),
          (this._offsetSeconds = 0),
          (this._firedEventValues = new u()))
      }
      release() {
        this._weight = 0
      }
      updateParameters(t, e, i) {
        if (!e.isAvailable() || e.isFinished()) return
        if (!e.isStarted()) {
          ;(e.setIsStarted(!0), e.setStartTime(i - this._offsetSeconds), e.setFadeInStartTime(i))
          const t = this.getDuration()
          e.getEndTime() < 0 && e.setEndTime(t <= 0 ? -1 : e.getStartTime() + t)
        }
        let s = this._weight
        ;((s =
          s *
          (0 == this._fadeInSeconds
            ? 1
            : ae.getEasingSine((i - e.getFadeInStartTime()) / this._fadeInSeconds)) *
          (0 == this._fadeOutSeconds || e.getEndTime() < 0
            ? 1
            : ae.getEasingSine((e.getEndTime() - i) / this._fadeOutSeconds))),
          e.setState(i, s),
          y(0 <= s && s <= 1),
          this.doUpdateParameters(t, i, s, e),
          e.getEndTime() > 0 && e.getEndTime() < i && e.setIsFinished(!0))
      }
      setFadeInTime(t) {
        this._fadeInSeconds = t
      }
      setFadeOutTime(t) {
        this._fadeOutSeconds = t
      }
      getFadeOutTime() {
        return this._fadeOutSeconds
      }
      getFadeInTime() {
        return this._fadeInSeconds
      }
      setWeight(t) {
        this._weight = t
      }
      getWeight() {
        return this._weight
      }
      getDuration() {
        return -1
      }
      getLoopDuration() {
        return -1
      }
      setOffsetTime(t) {
        this._offsetSeconds = t
      }
      getFiredEvent(t, e) {
        return this._firedEventValues
      }
      isExistModelOpacity() {
        return !1
      }
      getModelOpacityIndex() {
        return -1
      }
      getModelOpacityId(t) {
        return null
      }
      getModelOpacityValue() {
        return 1
      }
    }
    !(function (t) {
      t.ACubismMotion = oe
    })(ie || (ie = {}))
    const le = 'Parameters',
      ue = 'Blend'
    class he extends oe {
      static create(t, e) {
        const i = new he()
        return (i.parse(t, e), i)
      }
      doUpdateParameters(t, e, i, s) {
        for (let e = 0; e < this._parameters.getSize(); ++e) {
          const s = this._parameters.at(e)
          switch (s.blendType) {
            case ge.ExpressionBlendType_Add:
              t.addParameterValueById(s.parameterId, s.value, i)
              break
            case ge.ExpressionBlendType_Multiply:
              t.multiplyParameterValueById(s.parameterId, s.value, i)
              break
            case ge.ExpressionBlendType_Overwrite:
              t.setParameterValueById(s.parameterId, s.value, i)
          }
        }
      }
      parse(t, e) {
        const i = F.create(t, e),
          s = i.getRoot()
        ;(this.setFadeInTime(s.getValueByString('FadeInTime').toFloat(1)),
          this.setFadeOutTime(s.getValueByString('FadeOutTime').toFloat(1)))
        const r = s.getValueByString(le).getSize()
        this._parameters.prepareCapacity(r)
        for (let t = 0; t < r; ++t) {
          const e = s.getValueByString(le).getValueByIndex(t),
            i = J.getIdManager().getId(e.getValueByString('Id').getRawString()),
            r = e.getValueByString('Value').toFloat()
          let a
          a =
            e.getValueByString(ue).isNull() || 'Add' == e.getValueByString(ue).getString()
              ? ge.ExpressionBlendType_Add
              : 'Multiply' == e.getValueByString(ue).getString()
                ? ge.ExpressionBlendType_Multiply
                : 'Overwrite' == e.getValueByString(ue).getString()
                  ? ge.ExpressionBlendType_Overwrite
                  : ge.ExpressionBlendType_Add
          const n = new pe()
          ;((n.parameterId = i), (n.blendType = a), (n.value = r), this._parameters.pushBack(n))
        }
        F.delete(i)
      }
      constructor() {
        ;(super(), (this._parameters = new u()))
      }
    }
    var ge, de, ce, _e, me
    !(function (t) {
      ;((t[(t.ExpressionBlendType_Add = 0)] = 'ExpressionBlendType_Add'),
        (t[(t.ExpressionBlendType_Multiply = 1)] = 'ExpressionBlendType_Multiply'),
        (t[(t.ExpressionBlendType_Overwrite = 2)] = 'ExpressionBlendType_Overwrite'))
    })(ge || (ge = {}))
    class pe {}
    ;(!(function (t) {
      ;((t.CubismExpressionMotion = he), (t.ExpressionBlendType = ge), (t.ExpressionParameter = pe))
    })(de || (de = {})),
      (function (t) {
        ;((t[(t.CubismMotionCurveTarget_Model = 0)] = 'CubismMotionCurveTarget_Model'),
          (t[(t.CubismMotionCurveTarget_Parameter = 1)] = 'CubismMotionCurveTarget_Parameter'),
          (t[(t.CubismMotionCurveTarget_PartOpacity = 2)] = 'CubismMotionCurveTarget_PartOpacity'))
      })(ce || (ce = {})),
      (function (t) {
        ;((t[(t.CubismMotionSegmentType_Linear = 0)] = 'CubismMotionSegmentType_Linear'),
          (t[(t.CubismMotionSegmentType_Bezier = 1)] = 'CubismMotionSegmentType_Bezier'),
          (t[(t.CubismMotionSegmentType_Stepped = 2)] = 'CubismMotionSegmentType_Stepped'),
          (t[(t.CubismMotionSegmentType_InverseStepped = 3)] =
            'CubismMotionSegmentType_InverseStepped'))
      })(_e || (_e = {})))
    class fe {
      constructor() {
        ;((this.time = 0), (this.value = 0))
      }
    }
    class ye {
      constructor() {
        ;((this.evaluate = null), (this.basePointIndex = 0), (this.segmentType = 0))
      }
    }
    class Se {
      constructor() {
        ;((this.type = ce.CubismMotionCurveTarget_Model),
          (this.segmentCount = 0),
          (this.baseSegmentIndex = 0),
          (this.fadeInTime = 0),
          (this.fadeOutTime = 0))
      }
    }
    class xe {
      constructor() {
        this.fireTime = 0
      }
    }
    class Ce {
      constructor() {
        ;((this.duration = 0),
          (this.loop = !1),
          (this.curveCount = 0),
          (this.eventCount = 0),
          (this.fps = 0),
          (this.curves = new u()),
          (this.segments = new u()),
          (this.points = new u()),
          (this.events = new u()))
      }
    }
    !(function (t) {
      ;((t.CubismMotionCurve = Se),
        (t.CubismMotionCurveTarget = ce),
        (t.CubismMotionData = Ce),
        (t.CubismMotionEvent = xe),
        (t.CubismMotionPoint = fe),
        (t.CubismMotionSegment = ye),
        (t.CubismMotionSegmentType = _e))
    })(me || (me = {}))
    const Be = 'Meta',
      Me = 'Curves',
      be = 'FadeInTime',
      Pe = 'FadeOutTime',
      ve = 'Segments',
      we = 'UserData'
    class Ie {
      constructor(t, e) {
        this._json = F.create(t, e)
      }
      release() {
        F.delete(this._json)
      }
      getMotionDuration() {
        return this._json.getRoot().getValueByString(Be).getValueByString('Duration').toFloat()
      }
      isMotionLoop() {
        return this._json.getRoot().getValueByString(Be).getValueByString('Loop').toBoolean()
      }
      getEvaluationOptionFlag(t) {
        return (
          Te.EvaluationOptionFlag_AreBeziersRistricted == t &&
          this._json
            .getRoot()
            .getValueByString(Be)
            .getValueByString('AreBeziersRestricted')
            .toBoolean()
        )
      }
      getMotionCurveCount() {
        return this._json.getRoot().getValueByString(Be).getValueByString('CurveCount').toInt()
      }
      getMotionFps() {
        return this._json.getRoot().getValueByString(Be).getValueByString('Fps').toFloat()
      }
      getMotionTotalSegmentCount() {
        return this._json
          .getRoot()
          .getValueByString(Be)
          .getValueByString('TotalSegmentCount')
          .toInt()
      }
      getMotionTotalPointCount() {
        return this._json.getRoot().getValueByString(Be).getValueByString('TotalPointCount').toInt()
      }
      isExistMotionFadeInTime() {
        return !this._json.getRoot().getValueByString(Be).getValueByString(be).isNull()
      }
      isExistMotionFadeOutTime() {
        return !this._json.getRoot().getValueByString(Be).getValueByString(Pe).isNull()
      }
      getMotionFadeInTime() {
        return this._json.getRoot().getValueByString(Be).getValueByString(be).toFloat()
      }
      getMotionFadeOutTime() {
        return this._json.getRoot().getValueByString(Be).getValueByString(Pe).toFloat()
      }
      getMotionCurveTarget(t) {
        return this._json
          .getRoot()
          .getValueByString(Me)
          .getValueByIndex(t)
          .getValueByString('Target')
          .getRawString()
      }
      getMotionCurveId(t) {
        return J.getIdManager().getId(
          this._json
            .getRoot()
            .getValueByString(Me)
            .getValueByIndex(t)
            .getValueByString('Id')
            .getRawString()
        )
      }
      isExistMotionCurveFadeInTime(t) {
        return !this._json
          .getRoot()
          .getValueByString(Me)
          .getValueByIndex(t)
          .getValueByString(be)
          .isNull()
      }
      isExistMotionCurveFadeOutTime(t) {
        return !this._json
          .getRoot()
          .getValueByString(Me)
          .getValueByIndex(t)
          .getValueByString(Pe)
          .isNull()
      }
      getMotionCurveFadeInTime(t) {
        return this._json
          .getRoot()
          .getValueByString(Me)
          .getValueByIndex(t)
          .getValueByString(be)
          .toFloat()
      }
      getMotionCurveFadeOutTime(t) {
        return this._json
          .getRoot()
          .getValueByString(Me)
          .getValueByIndex(t)
          .getValueByString(Pe)
          .toFloat()
      }
      getMotionCurveSegmentCount(t) {
        return this._json
          .getRoot()
          .getValueByString(Me)
          .getValueByIndex(t)
          .getValueByString(ve)
          .getVector()
          .getSize()
      }
      getMotionCurveSegment(t, e) {
        return this._json
          .getRoot()
          .getValueByString(Me)
          .getValueByIndex(t)
          .getValueByString(ve)
          .getValueByIndex(e)
          .toFloat()
      }
      getEventCount() {
        return this._json.getRoot().getValueByString(Be).getValueByString('UserDataCount').toInt()
      }
      getTotalEventValueSize() {
        return this._json
          .getRoot()
          .getValueByString(Be)
          .getValueByString('TotalUserDataSize')
          .toInt()
      }
      getEventTime(t) {
        return this._json
          .getRoot()
          .getValueByString(we)
          .getValueByIndex(t)
          .getValueByString('Time')
          .toFloat()
      }
      getEventValue(t) {
        return new g(
          this._json
            .getRoot()
            .getValueByString(we)
            .getValueByIndex(t)
            .getValueByString('Value')
            .getRawString()
        )
      }
    }
    var Te, Ve
    ;(!(function (t) {
      t[(t.EvaluationOptionFlag_AreBeziersRistricted = 0)] =
        'EvaluationOptionFlag_AreBeziersRistricted'
    })(Te || (Te = {})),
      (function (t) {
        t.CubismMotionJson = Ie
      })(Ve || (Ve = {})))
    const Re = 'Opacity'
    function Ee(t, e, i) {
      const s = new fe()
      return (
        (s.time = t.time + (e.time - t.time) * i),
        (s.value = t.value + (e.value - t.value) * i),
        s
      )
    }
    function Fe(t, e) {
      let i = (e - t[0].time) / (t[1].time - t[0].time)
      return (i < 0 && (i = 0), t[0].value + (t[1].value - t[0].value) * i)
    }
    function Le(t, e) {
      let i = (e - t[0].time) / (t[3].time - t[0].time)
      i < 0 && (i = 0)
      const s = Ee(t[0], t[1], i),
        r = Ee(t[1], t[2], i),
        a = Ee(t[2], t[3], i),
        n = Ee(s, r, i),
        o = Ee(r, a, i)
      return Ee(n, o, i).value
    }
    function Ae(t, e) {
      const i = e,
        s = t[0].time,
        r = t[3].time,
        a = t[1].time,
        n = t[2].time,
        o = r - 3 * n + 3 * a - s,
        l = 3 * n - 6 * a + 3 * s,
        u = 3 * a - 3 * s,
        h = s - i,
        g = ae.cardanoAlgorithmForBezier(o, l, u, h),
        d = Ee(t[0], t[1], g),
        c = Ee(t[1], t[2], g),
        _ = Ee(t[2], t[3], g),
        m = Ee(d, c, g),
        p = Ee(c, _, g)
      return Ee(m, p, g).value
    }
    function De(t, e) {
      return t[0].value
    }
    function ke(t, e) {
      return t[1].value
    }
    function Oe(t, e, i) {
      const s = t.curves.at(e)
      let r = -1
      const a = s.baseSegmentIndex + s.segmentCount
      let n = 0
      for (let e = s.baseSegmentIndex; e < a; ++e)
        if (
          ((n =
            t.segments.at(e).basePointIndex +
            (t.segments.at(e).segmentType == _e.CubismMotionSegmentType_Bezier ? 3 : 1)),
          t.points.at(n).time > i)
        ) {
          r = e
          break
        }
      if (-1 == r) return t.points.at(n).value
      const o = t.segments.at(r)
      return o.evaluate(t.points.get(o.basePointIndex), i)
    }
    class Ne extends oe {
      static create(t, e, i) {
        const s = new Ne()
        return (
          s.parse(t, e),
          (s._sourceFrameRate = s._motionData.fps),
          (s._loopDurationSeconds = s._motionData.duration),
          (s._onFinishedMotion = i),
          s
        )
      }
      doUpdateParameters(t, e, i, s) {
        ;(null == this._modelCurveIdEyeBlink &&
          (this._modelCurveIdEyeBlink = J.getIdManager().getId('EyeBlink')),
          null == this._modelCurveIdLipSync &&
            (this._modelCurveIdLipSync = J.getIdManager().getId('LipSync')),
          null == this._modelCurveIdOpacity &&
            (this._modelCurveIdOpacity = J.getIdManager().getId(Re)))
        let r = e - s.getStartTime()
        r < 0 && (r = 0)
        let a = Number.MAX_VALUE,
          n = Number.MAX_VALUE
        const o = 64
        let l = 0,
          u = 0
        ;(this._eyeBlinkParameterIds.getSize() > o &&
          x('too many eye blink targets : {0}', this._eyeBlinkParameterIds.getSize()),
          this._lipSyncParameterIds.getSize() > o &&
            x('too many lip sync targets : {0}', this._lipSyncParameterIds.getSize()))
        const h =
            this._fadeInSeconds <= 0
              ? 1
              : ae.getEasingSine((e - s.getFadeInStartTime()) / this._fadeInSeconds),
          g =
            this._fadeOutSeconds <= 0 || s.getEndTime() < 0
              ? 1
              : ae.getEasingSine((s.getEndTime() - e) / this._fadeOutSeconds)
        let d,
          c,
          _,
          m = r
        if (this._isLoop) for (; m > this._motionData.duration; ) m -= this._motionData.duration
        const p = this._motionData.curves
        for (
          c = 0;
          c < this._motionData.curveCount && p.at(c).type == ce.CubismMotionCurveTarget_Model;
          ++c
        )
          ((d = Oe(this._motionData, c, m)),
            p.at(c).id == this._modelCurveIdEyeBlink
              ? (n = d)
              : p.at(c).id == this._modelCurveIdLipSync
                ? (a = d)
                : p.at(c).id == this._modelCurveIdOpacity &&
                  ((this._modelOpacity = d), t.setModelOapcity(this.getModelOpacityValue())))
        for (
          ;
          c < this._motionData.curveCount && p.at(c).type == ce.CubismMotionCurveTarget_Parameter;
          ++c
        ) {
          if (((_ = t.getParameterIndex(p.at(c).id)), -1 == _)) continue
          const r = t.getParameterValueByIndex(_)
          if (((d = Oe(this._motionData, c, m)), n != Number.MAX_VALUE))
            for (let t = 0; t < this._eyeBlinkParameterIds.getSize() && t < o; ++t)
              if (this._eyeBlinkParameterIds.at(t) == p.at(c).id) {
                ;((d *= n), (u |= 1 << t))
                break
              }
          if (a != Number.MAX_VALUE)
            for (let t = 0; t < this._lipSyncParameterIds.getSize() && t < o; ++t)
              if (this._lipSyncParameterIds.at(t) == p.at(c).id) {
                ;((d += a), (l |= 1 << t))
                break
              }
          let f
          if (p.at(c).fadeInTime < 0 && p.at(c).fadeOutTime < 0) f = r + (d - r) * i
          else {
            let t, i
            ;((t =
              p.at(c).fadeInTime < 0
                ? h
                : 0 == p.at(c).fadeInTime
                  ? 1
                  : ae.getEasingSine((e - s.getFadeInStartTime()) / p.at(c).fadeInTime)),
              (i =
                p.at(c).fadeOutTime < 0
                  ? g
                  : 0 == p.at(c).fadeOutTime || s.getEndTime() < 0
                    ? 1
                    : ae.getEasingSine((s.getEndTime() - e) / p.at(c).fadeOutTime)),
              (f = r + (d - r) * (this._weight * t * i)))
          }
          t.setParameterValueByIndex(_, f, 1)
        }
        if (n != Number.MAX_VALUE)
          for (let e = 0; e < this._eyeBlinkParameterIds.getSize() && e < o; ++e) {
            const s = t.getParameterValueById(this._eyeBlinkParameterIds.at(e))
            if ((u >> e) & 1) continue
            const r = s + (n - s) * i
            t.setParameterValueById(this._eyeBlinkParameterIds.at(e), r)
          }
        if (a != Number.MAX_VALUE)
          for (let e = 0; e < this._lipSyncParameterIds.getSize() && e < o; ++e) {
            const s = t.getParameterValueById(this._lipSyncParameterIds.at(e))
            if ((l >> e) & 1) continue
            const r = s + (a - s) * i
            t.setParameterValueById(this._lipSyncParameterIds.at(e), r)
          }
        for (
          ;
          c < this._motionData.curveCount && p.at(c).type == ce.CubismMotionCurveTarget_PartOpacity;
          ++c
        )
          ((_ = t.getParameterIndex(p.at(c).id)),
            -1 != _ && ((d = Oe(this._motionData, c, m)), t.setParameterValueByIndex(_, d)))
        ;(r >= this._motionData.duration &&
          (this._isLoop
            ? (s.setStartTime(e), this._isLoopFadeIn && s.setFadeInStartTime(e))
            : (this._onFinishedMotion && this._onFinishedMotion(this), s.setIsFinished(!0))),
          (this._lastWeight = i))
      }
      setIsLoop(t) {
        this._isLoop = t
      }
      isLoop() {
        return this._isLoop
      }
      setIsLoopFadeIn(t) {
        this._isLoopFadeIn = t
      }
      isLoopFadeIn() {
        return this._isLoopFadeIn
      }
      getDuration() {
        return this._isLoop ? -1 : this._loopDurationSeconds
      }
      getLoopDuration() {
        return this._loopDurationSeconds
      }
      setParameterFadeInTime(t, e) {
        const i = this._motionData.curves
        for (let s = 0; s < this._motionData.curveCount; ++s)
          if (t == i.at(s).id) return void (i.at(s).fadeInTime = e)
      }
      setParameterFadeOutTime(t, e) {
        const i = this._motionData.curves
        for (let s = 0; s < this._motionData.curveCount; ++s)
          if (t == i.at(s).id) return void (i.at(s).fadeOutTime = e)
      }
      getParameterFadeInTime(t) {
        const e = this._motionData.curves
        for (let i = 0; i < this._motionData.curveCount; ++i)
          if (t == e.at(i).id) return e.at(i).fadeInTime
        return -1
      }
      getParameterFadeOutTime(t) {
        const e = this._motionData.curves
        for (let i = 0; i < this._motionData.curveCount; ++i)
          if (t == e.at(i).id) return e.at(i).fadeOutTime
        return -1
      }
      setEffectIds(t, e) {
        ;((this._eyeBlinkParameterIds = t), (this._lipSyncParameterIds = e))
      }
      constructor() {
        ;(super(),
          (this._sourceFrameRate = 30),
          (this._loopDurationSeconds = -1),
          (this._isLoop = !1),
          (this._isLoopFadeIn = !0),
          (this._lastWeight = 0),
          (this._motionData = null),
          (this._modelCurveIdEyeBlink = null),
          (this._modelCurveIdLipSync = null),
          (this._modelCurveIdOpacity = null),
          (this._eyeBlinkParameterIds = null),
          (this._lipSyncParameterIds = null),
          (this._modelOpacity = 1))
      }
      release() {
        ;((this._motionData = void 0), (this._motionData = null))
      }
      parse(t, e) {
        this._motionData = new Ce()
        let i = new Ie(t, e)
        ;((this._motionData.duration = i.getMotionDuration()),
          (this._motionData.loop = i.isMotionLoop()),
          (this._motionData.curveCount = i.getMotionCurveCount()),
          (this._motionData.fps = i.getMotionFps()),
          (this._motionData.eventCount = i.getEventCount()))
        const s = i.getEvaluationOptionFlag(Te.EvaluationOptionFlag_AreBeziersRistricted)
        ;(i.isExistMotionFadeInTime()
          ? (this._fadeInSeconds = i.getMotionFadeInTime() < 0 ? 1 : i.getMotionFadeInTime())
          : (this._fadeInSeconds = 1),
          i.isExistMotionFadeOutTime()
            ? (this._fadeOutSeconds = i.getMotionFadeOutTime() < 0 ? 1 : i.getMotionFadeOutTime())
            : (this._fadeOutSeconds = 1),
          this._motionData.curves.updateSize(this._motionData.curveCount, Se, !0),
          this._motionData.segments.updateSize(i.getMotionTotalSegmentCount(), ye, !0),
          this._motionData.points.updateSize(i.getMotionTotalPointCount(), fe, !0),
          this._motionData.events.updateSize(this._motionData.eventCount, xe, !0))
        let r = 0,
          a = 0
        for (let t = 0; t < this._motionData.curveCount; ++t) {
          ;('Model' == i.getMotionCurveTarget(t)
            ? (this._motionData.curves.at(t).type = ce.CubismMotionCurveTarget_Model)
            : 'Parameter' == i.getMotionCurveTarget(t)
              ? (this._motionData.curves.at(t).type = ce.CubismMotionCurveTarget_Parameter)
              : 'PartOpacity' == i.getMotionCurveTarget(t)
                ? (this._motionData.curves.at(t).type = ce.CubismMotionCurveTarget_PartOpacity)
                : B(
                    'Warning : Unable to get segment type from Curve! The number of "CurveCount" may be incorrect!'
                  ),
            (this._motionData.curves.at(t).id = i.getMotionCurveId(t)),
            (this._motionData.curves.at(t).baseSegmentIndex = a),
            (this._motionData.curves.at(t).fadeInTime = i.isExistMotionCurveFadeInTime(t)
              ? i.getMotionCurveFadeInTime(t)
              : -1),
            (this._motionData.curves.at(t).fadeOutTime = i.isExistMotionCurveFadeOutTime(t)
              ? i.getMotionCurveFadeOutTime(t)
              : -1))
          for (let e = 0; e < i.getMotionCurveSegmentCount(t); ) {
            switch (
              (0 == e
                ? ((this._motionData.segments.at(a).basePointIndex = r),
                  (this._motionData.points.at(r).time = i.getMotionCurveSegment(t, e)),
                  (this._motionData.points.at(r).value = i.getMotionCurveSegment(t, e + 1)),
                  (r += 1),
                  (e += 2))
                : (this._motionData.segments.at(a).basePointIndex = r - 1),
              i.getMotionCurveSegment(t, e))
            ) {
              case _e.CubismMotionSegmentType_Linear:
                ;((this._motionData.segments.at(a).segmentType = _e.CubismMotionSegmentType_Linear),
                  (this._motionData.segments.at(a).evaluate = Fe),
                  (this._motionData.points.at(r).time = i.getMotionCurveSegment(t, e + 1)),
                  (this._motionData.points.at(r).value = i.getMotionCurveSegment(t, e + 2)),
                  (r += 1),
                  (e += 3))
                break
              case _e.CubismMotionSegmentType_Bezier:
                ;((this._motionData.segments.at(a).segmentType = _e.CubismMotionSegmentType_Bezier),
                  (this._motionData.segments.at(a).evaluate = s ? Le : Ae),
                  (this._motionData.points.at(r).time = i.getMotionCurveSegment(t, e + 1)),
                  (this._motionData.points.at(r).value = i.getMotionCurveSegment(t, e + 2)),
                  (this._motionData.points.at(r + 1).time = i.getMotionCurveSegment(t, e + 3)),
                  (this._motionData.points.at(r + 1).value = i.getMotionCurveSegment(t, e + 4)),
                  (this._motionData.points.at(r + 2).time = i.getMotionCurveSegment(t, e + 5)),
                  (this._motionData.points.at(r + 2).value = i.getMotionCurveSegment(t, e + 6)),
                  (r += 3),
                  (e += 7))
                break
              case _e.CubismMotionSegmentType_Stepped:
                ;((this._motionData.segments.at(a).segmentType =
                  _e.CubismMotionSegmentType_Stepped),
                  (this._motionData.segments.at(a).evaluate = De),
                  (this._motionData.points.at(r).time = i.getMotionCurveSegment(t, e + 1)),
                  (this._motionData.points.at(r).value = i.getMotionCurveSegment(t, e + 2)),
                  (r += 1),
                  (e += 3))
                break
              case _e.CubismMotionSegmentType_InverseStepped:
                ;((this._motionData.segments.at(a).segmentType =
                  _e.CubismMotionSegmentType_InverseStepped),
                  (this._motionData.segments.at(a).evaluate = ke),
                  (this._motionData.points.at(r).time = i.getMotionCurveSegment(t, e + 1)),
                  (this._motionData.points.at(r).value = i.getMotionCurveSegment(t, e + 2)),
                  (r += 1),
                  (e += 3))
                break
              default:
                y(0)
            }
            ;(++this._motionData.curves.at(t).segmentCount, ++a)
          }
        }
        for (let t = 0; t < i.getEventCount(); ++t)
          ((this._motionData.events.at(t).fireTime = i.getEventTime(t)),
            (this._motionData.events.at(t).value = i.getEventValue(t)))
        ;(i.release(), (i = void 0), (i = null))
      }
      getFiredEvent(t, e) {
        this._firedEventValues.updateSize(0)
        for (let i = 0; i < this._motionData.eventCount; ++i)
          this._motionData.events.at(i).fireTime > t &&
            this._motionData.events.at(i).fireTime <= e &&
            this._firedEventValues.pushBack(new g(this._motionData.events.at(i).value.s))
        return this._firedEventValues
      }
      isExistModelOpacity() {
        for (let t = 0; t < this._motionData.curveCount; t++) {
          const e = this._motionData.curves.at(t)
          if (
            e.type == ce.CubismMotionCurveTarget_Model &&
            0 == e.id.getString().s.localeCompare(Re)
          )
            return !0
        }
        return !1
      }
      getModelOpacityIndex() {
        if (this.isExistModelOpacity())
          for (let t = 0; t < this._motionData.curveCount; t++) {
            const e = this._motionData.curves.at(t)
            if (
              e.type == ce.CubismMotionCurveTarget_Model &&
              0 == e.id.getString().s.localeCompare(Re)
            )
              return t
          }
        return -1
      }
      getModelOpacityId(t) {
        if (-1 != t) {
          const e = this._motionData.curves.at(t)
          if (
            e.type == ce.CubismMotionCurveTarget_Model &&
            0 == e.id.getString().s.localeCompare(Re)
          )
            return J.getIdManager().getId(e.id.getString().s)
        }
        return null
      }
      getModelOpacityValue() {
        return this._modelOpacity
      }
    }
    var Ue, ze
    !(function (t) {
      t.CubismMotion = Ne
    })(Ue || (Ue = {}))
    class je {
      constructor() {
        ;((this._autoDelete = !1),
          (this._motion = null),
          (this._available = !0),
          (this._finished = !1),
          (this._started = !1),
          (this._startTimeSeconds = -1),
          (this._fadeInStartTimeSeconds = 0),
          (this._endTimeSeconds = -1),
          (this._stateTimeSeconds = 0),
          (this._stateWeight = 0),
          (this._lastEventCheckSeconds = 0),
          (this._motionQueueEntryHandle = this),
          (this._fadeOutSeconds = 0),
          (this._isTriggeredFadeOut = !1))
      }
      release() {
        this._autoDelete && this._motion && oe.delete(this._motion)
      }
      setFadeOut(t) {
        ;((this._fadeOutSeconds = t), (this._isTriggeredFadeOut = !0))
      }
      startFadeOut(t, e) {
        const i = e + t
        ;((this._isTriggeredFadeOut = !0),
          (this._endTimeSeconds < 0 || i < this._endTimeSeconds) && (this._endTimeSeconds = i))
      }
      isFinished() {
        return this._finished
      }
      isStarted() {
        return this._started
      }
      getStartTime() {
        return this._startTimeSeconds
      }
      getFadeInStartTime() {
        return this._fadeInStartTimeSeconds
      }
      getEndTime() {
        return this._endTimeSeconds
      }
      setStartTime(t) {
        this._startTimeSeconds = t
      }
      setFadeInStartTime(t) {
        this._fadeInStartTimeSeconds = t
      }
      setEndTime(t) {
        this._endTimeSeconds = t
      }
      setIsFinished(t) {
        this._finished = t
      }
      setIsStarted(t) {
        this._started = t
      }
      isAvailable() {
        return this._available
      }
      setIsAvailable(t) {
        this._available = t
      }
      setState(t, e) {
        ;((this._stateTimeSeconds = t), (this._stateWeight = e))
      }
      getStateTime() {
        return this._stateTimeSeconds
      }
      getStateWeight() {
        return this._stateWeight
      }
      getLastCheckEventSeconds() {
        return this._lastEventCheckSeconds
      }
      setLastCheckEventSeconds(t) {
        this._lastEventCheckSeconds = t
      }
      isTriggeredFadeOut() {
        return this._isTriggeredFadeOut
      }
      getFadeOutSeconds() {
        return this._fadeOutSeconds
      }
    }
    !(function (t) {
      t.CubismMotionQueueEntry = je
    })(ze || (ze = {}))
    class Xe {
      constructor() {
        ;((this._userTimeSeconds = 0),
          (this._eventCallBack = null),
          (this._eventCustomData = null),
          (this._motions = new u()))
      }
      release() {
        for (let t = 0; t < this._motions.getSize(); ++t)
          this._motions.at(t) && (this._motions.at(t).release(), this._motions.set(t, null))
        this._motions = null
      }
      startMotion(t, e, i) {
        if (null == t) return Ge
        let s = null
        for (let t = 0; t < this._motions.getSize(); ++t)
          ((s = this._motions.at(t)), null != s && s.setFadeOut(s._motion.getFadeOutTime()))
        return (
          (s = new je()),
          (s._autoDelete = e),
          (s._motion = t),
          this._motions.pushBack(s),
          s._motionQueueEntryHandle
        )
      }
      isFinished() {
        for (let t = this._motions.begin(); t.notEqual(this._motions.end()); ) {
          let e = t.ptr()
          if (null != e)
            if (null != e._motion) {
              if (!e.isFinished()) return !1
              t.preIncrement()
            } else (e.release(), (e = null), (t = this._motions.erase(t)))
          else t = this._motions.erase(t)
        }
        return !0
      }
      isFinishedByHandle(t) {
        for (let e = this._motions.begin(); e.notEqual(this._motions.end()); e.increment()) {
          const i = e.ptr()
          if (null != i && i._motionQueueEntryHandle == t && !i.isFinished()) return !1
        }
        return !0
      }
      stopAllMotions() {
        for (let t = this._motions.begin(); t.notEqual(this._motions.end()); ) {
          let e = t.ptr()
          null != e
            ? (e.release(), (e = null), (t = this._motions.erase(t)))
            : (t = this._motions.erase(t))
        }
      }
      getCubismMotionQueueEntry(t) {
        for (let e = this._motions.begin(); e.notEqual(this._motions.end()); e.preIncrement()) {
          const i = e.ptr()
          if (null != i && i._motionQueueEntryHandle == t) return i
        }
        return null
      }
      setEventCallback(t, e = null) {
        ;((this._eventCallBack = t), (this._eventCustomData = e))
      }
      doUpdateMotion(t, e) {
        let i = !1
        for (let s = this._motions.begin(); s.notEqual(this._motions.end()); ) {
          let r = s.ptr()
          if (null == r) {
            s = this._motions.erase(s)
            continue
          }
          const a = r._motion
          if (null == a) {
            ;(r.release(), (r = null), (s = this._motions.erase(s)))
            continue
          }
          ;(a.updateParameters(t, r, e), (i = !0))
          const n = a.getFiredEvent(
            r.getLastCheckEventSeconds() - r.getStartTime(),
            e - r.getStartTime()
          )
          for (let t = 0; t < n.getSize(); ++t)
            this._eventCallBack(this, n.at(t), this._eventCustomData)
          ;(r.setLastCheckEventSeconds(e),
            r.isFinished()
              ? (r.release(), (r = null), (s = this._motions.erase(s)))
              : (r.isTriggeredFadeOut() && r.startFadeOut(r.getFadeOutSeconds(), e),
                s.preIncrement()))
        }
        return i
      }
    }
    const Ge = -1
    var Ye, He, qe, We, Je
    !(function (t) {
      ;((t.CubismMotionQueueManager = Xe), (t.InvalidMotionQueueEntryHandleValue = Ge))
    })(Ye || (Ye = {}))
    class $e extends Xe {
      constructor() {
        ;(super(), (this._currentPriority = 0), (this._reservePriority = 0))
      }
      getCurrentPriority() {
        return this._currentPriority
      }
      getReservePriority() {
        return this._reservePriority
      }
      setReservePriority(t) {
        this._reservePriority = t
      }
      startMotionPriority(t, e, i) {
        return (
          i == this._reservePriority && (this._reservePriority = 0),
          (this._currentPriority = i),
          super.startMotion(t, e, this._userTimeSeconds)
        )
      }
      updateMotion(t, e) {
        this._userTimeSeconds += e
        const i = super.doUpdateMotion(t, this._userTimeSeconds)
        return (this.isFinished() && (this._currentPriority = 0), i)
      }
      reserveMotion(t) {
        return !(
          t <= this._reservePriority ||
          t <= this._currentPriority ||
          ((this._reservePriority = t), 0)
        )
      }
    }
    ;(!(function (t) {
      t.CubismMotionManager = $e
    })(He || (He = {})),
      (function (t) {
        t[(t.CubismPhysicsTargetType_Parameter = 0)] = 'CubismPhysicsTargetType_Parameter'
      })(qe || (qe = {})),
      (function (t) {
        ;((t[(t.CubismPhysicsSource_X = 0)] = 'CubismPhysicsSource_X'),
          (t[(t.CubismPhysicsSource_Y = 1)] = 'CubismPhysicsSource_Y'),
          (t[(t.CubismPhysicsSource_Angle = 2)] = 'CubismPhysicsSource_Angle'))
      })(We || (We = {})))
    class Ze {
      constructor() {
        ;((this.gravity = new re(0, 0)), (this.wind = new re(0, 0)))
      }
    }
    class Ke {}
    class Qe {}
    class ti {
      constructor() {
        ;((this.initialPosition = new re(0, 0)),
          (this.position = new re(0, 0)),
          (this.lastPosition = new re(0, 0)),
          (this.lastGravity = new re(0, 0)),
          (this.force = new re(0, 0)),
          (this.velocity = new re(0, 0)))
      }
    }
    class ei {
      constructor() {
        ;((this.normalizationPosition = new Qe()), (this.normalizationAngle = new Qe()))
      }
    }
    class ii {
      constructor() {
        this.source = new Ke()
      }
    }
    class si {
      constructor() {
        ;((this.destination = new Ke()), (this.translationScale = new re(0, 0)))
      }
    }
    class ri {
      constructor() {
        ;((this.settings = new u()),
          (this.inputs = new u()),
          (this.outputs = new u()),
          (this.particles = new u()),
          (this.gravity = new re(0, 0)),
          (this.wind = new re(0, 0)),
          (this.fps = 0))
      }
    }
    !(function (t) {
      ;((t.CubismPhysicsInput = ii),
        (t.CubismPhysicsNormalization = Qe),
        (t.CubismPhysicsOutput = si),
        (t.CubismPhysicsParameter = Ke),
        (t.CubismPhysicsParticle = ti),
        (t.CubismPhysicsRig = ri),
        (t.CubismPhysicsSource = We),
        (t.CubismPhysicsSubRig = ei),
        (t.CubismPhysicsTargetType = qe),
        (t.PhysicsJsonEffectiveForces = Ze))
    })(Je || (Je = {}))
    const ai = 'Position',
      ni = 'Angle',
      oi = 'Type',
      li = 'Meta',
      ui = 'EffectiveForces',
      hi = 'Gravity',
      gi = 'Wind',
      di = 'PhysicsSettings',
      ci = 'Normalization',
      _i = 'Minimum',
      mi = 'Maximum',
      pi = 'Default',
      fi = 'Reflect',
      yi = 'Weight',
      Si = 'Input',
      xi = 'Output',
      Ci = 'Vertices'
    class Bi {
      constructor(t, e) {
        this._json = F.create(t, e)
      }
      release() {
        F.delete(this._json)
      }
      getGravity() {
        const t = new re(0, 0)
        return (
          (t.x = this._json
            .getRoot()
            .getValueByString(li)
            .getValueByString(ui)
            .getValueByString(hi)
            .getValueByString('X')
            .toFloat()),
          (t.y = this._json
            .getRoot()
            .getValueByString(li)
            .getValueByString(ui)
            .getValueByString(hi)
            .getValueByString('Y')
            .toFloat()),
          t
        )
      }
      getWind() {
        const t = new re(0, 0)
        return (
          (t.x = this._json
            .getRoot()
            .getValueByString(li)
            .getValueByString(ui)
            .getValueByString(gi)
            .getValueByString('X')
            .toFloat()),
          (t.y = this._json
            .getRoot()
            .getValueByString(li)
            .getValueByString(ui)
            .getValueByString(gi)
            .getValueByString('Y')
            .toFloat()),
          t
        )
      }
      getFps() {
        return this._json.getRoot().getValueByString(li).getValueByString('Fps').toFloat(0)
      }
      getSubRigCount() {
        return this._json
          .getRoot()
          .getValueByString(li)
          .getValueByString('PhysicsSettingCount')
          .toInt()
      }
      getTotalInputCount() {
        return this._json.getRoot().getValueByString(li).getValueByString('TotalInputCount').toInt()
      }
      getTotalOutputCount() {
        return this._json
          .getRoot()
          .getValueByString(li)
          .getValueByString('TotalOutputCount')
          .toInt()
      }
      getVertexCount() {
        return this._json.getRoot().getValueByString(li).getValueByString('VertexCount').toInt()
      }
      getNormalizationPositionMinimumValue(t) {
        return this._json
          .getRoot()
          .getValueByString(di)
          .getValueByIndex(t)
          .getValueByString(ci)
          .getValueByString(ai)
          .getValueByString(_i)
          .toFloat()
      }
      getNormalizationPositionMaximumValue(t) {
        return this._json
          .getRoot()
          .getValueByString(di)
          .getValueByIndex(t)
          .getValueByString(ci)
          .getValueByString(ai)
          .getValueByString(mi)
          .toFloat()
      }
      getNormalizationPositionDefaultValue(t) {
        return this._json
          .getRoot()
          .getValueByString(di)
          .getValueByIndex(t)
          .getValueByString(ci)
          .getValueByString(ai)
          .getValueByString(pi)
          .toFloat()
      }
      getNormalizationAngleMinimumValue(t) {
        return this._json
          .getRoot()
          .getValueByString(di)
          .getValueByIndex(t)
          .getValueByString(ci)
          .getValueByString(ni)
          .getValueByString(_i)
          .toFloat()
      }
      getNormalizationAngleMaximumValue(t) {
        return this._json
          .getRoot()
          .getValueByString(di)
          .getValueByIndex(t)
          .getValueByString(ci)
          .getValueByString(ni)
          .getValueByString(mi)
          .toFloat()
      }
      getNormalizationAngleDefaultValue(t) {
        return this._json
          .getRoot()
          .getValueByString(di)
          .getValueByIndex(t)
          .getValueByString(ci)
          .getValueByString(ni)
          .getValueByString(pi)
          .toFloat()
      }
      getInputCount(t) {
        return this._json
          .getRoot()
          .getValueByString(di)
          .getValueByIndex(t)
          .getValueByString(Si)
          .getVector()
          .getSize()
      }
      getInputWeight(t, e) {
        return this._json
          .getRoot()
          .getValueByString(di)
          .getValueByIndex(t)
          .getValueByString(Si)
          .getValueByIndex(e)
          .getValueByString(yi)
          .toFloat()
      }
      getInputReflect(t, e) {
        return this._json
          .getRoot()
          .getValueByString(di)
          .getValueByIndex(t)
          .getValueByString(Si)
          .getValueByIndex(e)
          .getValueByString(fi)
          .toBoolean()
      }
      getInputType(t, e) {
        return this._json
          .getRoot()
          .getValueByString(di)
          .getValueByIndex(t)
          .getValueByString(Si)
          .getValueByIndex(e)
          .getValueByString(oi)
          .getRawString()
      }
      getInputSourceId(t, e) {
        return J.getIdManager().getId(
          this._json
            .getRoot()
            .getValueByString(di)
            .getValueByIndex(t)
            .getValueByString(Si)
            .getValueByIndex(e)
            .getValueByString('Source')
            .getValueByString('Id')
            .getRawString()
        )
      }
      getOutputCount(t) {
        return this._json
          .getRoot()
          .getValueByString(di)
          .getValueByIndex(t)
          .getValueByString(xi)
          .getVector()
          .getSize()
      }
      getOutputVertexIndex(t, e) {
        return this._json
          .getRoot()
          .getValueByString(di)
          .getValueByIndex(t)
          .getValueByString(xi)
          .getValueByIndex(e)
          .getValueByString('VertexIndex')
          .toInt()
      }
      getOutputAngleScale(t, e) {
        return this._json
          .getRoot()
          .getValueByString(di)
          .getValueByIndex(t)
          .getValueByString(xi)
          .getValueByIndex(e)
          .getValueByString('Scale')
          .toFloat()
      }
      getOutputWeight(t, e) {
        return this._json
          .getRoot()
          .getValueByString(di)
          .getValueByIndex(t)
          .getValueByString(xi)
          .getValueByIndex(e)
          .getValueByString(yi)
          .toFloat()
      }
      getOutputDestinationId(t, e) {
        return J.getIdManager().getId(
          this._json
            .getRoot()
            .getValueByString(di)
            .getValueByIndex(t)
            .getValueByString(xi)
            .getValueByIndex(e)
            .getValueByString('Destination')
            .getValueByString('Id')
            .getRawString()
        )
      }
      getOutputType(t, e) {
        return this._json
          .getRoot()
          .getValueByString(di)
          .getValueByIndex(t)
          .getValueByString(xi)
          .getValueByIndex(e)
          .getValueByString(oi)
          .getRawString()
      }
      getOutputReflect(t, e) {
        return this._json
          .getRoot()
          .getValueByString(di)
          .getValueByIndex(t)
          .getValueByString(xi)
          .getValueByIndex(e)
          .getValueByString(fi)
          .toBoolean()
      }
      getParticleCount(t) {
        return this._json
          .getRoot()
          .getValueByString(di)
          .getValueByIndex(t)
          .getValueByString(Ci)
          .getVector()
          .getSize()
      }
      getParticleMobility(t, e) {
        return this._json
          .getRoot()
          .getValueByString(di)
          .getValueByIndex(t)
          .getValueByString(Ci)
          .getValueByIndex(e)
          .getValueByString('Mobility')
          .toFloat()
      }
      getParticleDelay(t, e) {
        return this._json
          .getRoot()
          .getValueByString(di)
          .getValueByIndex(t)
          .getValueByString(Ci)
          .getValueByIndex(e)
          .getValueByString('Delay')
          .toFloat()
      }
      getParticleAcceleration(t, e) {
        return this._json
          .getRoot()
          .getValueByString(di)
          .getValueByIndex(t)
          .getValueByString(Ci)
          .getValueByIndex(e)
          .getValueByString('Acceleration')
          .toFloat()
      }
      getParticleRadius(t, e) {
        return this._json
          .getRoot()
          .getValueByString(di)
          .getValueByIndex(t)
          .getValueByString(Ci)
          .getValueByIndex(e)
          .getValueByString('Radius')
          .toFloat()
      }
      getParticlePosition(t, e) {
        const i = new re(0, 0)
        return (
          (i.x = this._json
            .getRoot()
            .getValueByString(di)
            .getValueByIndex(t)
            .getValueByString(Ci)
            .getValueByIndex(e)
            .getValueByString(ai)
            .getValueByString('X')
            .toFloat()),
          (i.y = this._json
            .getRoot()
            .getValueByString(di)
            .getValueByIndex(t)
            .getValueByString(Ci)
            .getValueByIndex(e)
            .getValueByString(ai)
            .getValueByString('Y')
            .toFloat()),
          i
        )
      }
    }
    var Mi
    !(function (t) {
      t.CubismPhysicsJson = Bi
    })(Mi || (Mi = {}))
    const bi = 'Angle'
    class Pi {
      static create(t, e) {
        const i = new Pi()
        return (i.parse(t, e), (i._physicsRig.gravity.y = 0), i)
      }
      static delete(t) {
        null != t && (t.release(), (t = null))
      }
      parse(t, e) {
        this._physicsRig = new ri()
        let i = new Bi(t, e)
        ;((this._physicsRig.gravity = i.getGravity()),
          (this._physicsRig.wind = i.getWind()),
          (this._physicsRig.subRigCount = i.getSubRigCount()),
          (this._physicsRig.fps = i.getFps()),
          this._physicsRig.settings.updateSize(this._physicsRig.subRigCount, ei, !0),
          this._physicsRig.inputs.updateSize(i.getTotalInputCount(), ii, !0),
          this._physicsRig.outputs.updateSize(i.getTotalOutputCount(), si, !0),
          this._physicsRig.particles.updateSize(i.getVertexCount(), ti, !0),
          this._currentRigOutputs.clear(),
          this._previousRigOutputs.clear())
        let s = 0,
          r = 0,
          a = 0
        for (let t = 0; t < this._physicsRig.settings.getSize(); ++t) {
          ;((this._physicsRig.settings.at(t).normalizationPosition.minimum =
            i.getNormalizationPositionMinimumValue(t)),
            (this._physicsRig.settings.at(t).normalizationPosition.maximum =
              i.getNormalizationPositionMaximumValue(t)),
            (this._physicsRig.settings.at(t).normalizationPosition.defalut =
              i.getNormalizationPositionDefaultValue(t)),
            (this._physicsRig.settings.at(t).normalizationAngle.minimum =
              i.getNormalizationAngleMinimumValue(t)),
            (this._physicsRig.settings.at(t).normalizationAngle.maximum =
              i.getNormalizationAngleMaximumValue(t)),
            (this._physicsRig.settings.at(t).normalizationAngle.defalut =
              i.getNormalizationAngleDefaultValue(t)),
            (this._physicsRig.settings.at(t).inputCount = i.getInputCount(t)),
            (this._physicsRig.settings.at(t).baseInputIndex = s))
          for (let e = 0; e < this._physicsRig.settings.at(t).inputCount; ++e)
            ((this._physicsRig.inputs.at(s + e).sourceParameterIndex = -1),
              (this._physicsRig.inputs.at(s + e).weight = i.getInputWeight(t, e)),
              (this._physicsRig.inputs.at(s + e).reflect = i.getInputReflect(t, e)),
              'X' == i.getInputType(t, e)
                ? ((this._physicsRig.inputs.at(s + e).type = We.CubismPhysicsSource_X),
                  (this._physicsRig.inputs.at(s + e).getNormalizedParameterValue = Ii))
                : 'Y' == i.getInputType(t, e)
                  ? ((this._physicsRig.inputs.at(s + e).type = We.CubismPhysicsSource_Y),
                    (this._physicsRig.inputs.at(s + e).getNormalizedParameterValue = Ti))
                  : i.getInputType(t, e) == bi &&
                    ((this._physicsRig.inputs.at(s + e).type = We.CubismPhysicsSource_Angle),
                    (this._physicsRig.inputs.at(s + e).getNormalizedParameterValue = Vi)),
              (this._physicsRig.inputs.at(s + e).source.targetType =
                qe.CubismPhysicsTargetType_Parameter),
              (this._physicsRig.inputs.at(s + e).source.id = i.getInputSourceId(t, e)))
          ;((s += this._physicsRig.settings.at(t).inputCount),
            (this._physicsRig.settings.at(t).outputCount = i.getOutputCount(t)),
            (this._physicsRig.settings.at(t).baseOutputIndex = r))
          const e = new wi()
          e.outputs.resize(this._physicsRig.settings.at(t).outputCount)
          const n = new wi()
          n.outputs.resize(this._physicsRig.settings.at(t).outputCount)
          for (let s = 0; s < this._physicsRig.settings.at(t).outputCount; ++s)
            (e.outputs.set(s, 0),
              n.outputs.set(s, 0),
              (this._physicsRig.outputs.at(r + s).destinationParameterIndex = -1),
              (this._physicsRig.outputs.at(r + s).vertexIndex = i.getOutputVertexIndex(t, s)),
              (this._physicsRig.outputs.at(r + s).angleScale = i.getOutputAngleScale(t, s)),
              (this._physicsRig.outputs.at(r + s).weight = i.getOutputWeight(t, s)),
              (this._physicsRig.outputs.at(r + s).destination.targetType =
                qe.CubismPhysicsTargetType_Parameter),
              (this._physicsRig.outputs.at(r + s).destination.id = i.getOutputDestinationId(t, s)),
              'X' == i.getOutputType(t, s)
                ? ((this._physicsRig.outputs.at(r + s).type = We.CubismPhysicsSource_X),
                  (this._physicsRig.outputs.at(r + s).getValue = Ri),
                  (this._physicsRig.outputs.at(r + s).getScale = Li))
                : 'Y' == i.getOutputType(t, s)
                  ? ((this._physicsRig.outputs.at(r + s).type = We.CubismPhysicsSource_Y),
                    (this._physicsRig.outputs.at(r + s).getValue = Ei),
                    (this._physicsRig.outputs.at(r + s).getScale = Ai))
                  : i.getOutputType(t, s) == bi &&
                    ((this._physicsRig.outputs.at(r + s).type = We.CubismPhysicsSource_Angle),
                    (this._physicsRig.outputs.at(r + s).getValue = Fi),
                    (this._physicsRig.outputs.at(r + s).getScale = Di)),
              (this._physicsRig.outputs.at(r + s).reflect = i.getOutputReflect(t, s)))
          ;(this._currentRigOutputs.pushBack(e),
            this._previousRigOutputs.pushBack(n),
            (r += this._physicsRig.settings.at(t).outputCount),
            (this._physicsRig.settings.at(t).particleCount = i.getParticleCount(t)),
            (this._physicsRig.settings.at(t).baseParticleIndex = a))
          for (let e = 0; e < this._physicsRig.settings.at(t).particleCount; ++e)
            ((this._physicsRig.particles.at(a + e).mobility = i.getParticleMobility(t, e)),
              (this._physicsRig.particles.at(a + e).delay = i.getParticleDelay(t, e)),
              (this._physicsRig.particles.at(a + e).acceleration = i.getParticleAcceleration(t, e)),
              (this._physicsRig.particles.at(a + e).radius = i.getParticleRadius(t, e)),
              (this._physicsRig.particles.at(a + e).position = i.getParticlePosition(t, e)))
          a += this._physicsRig.settings.at(t).particleCount
        }
        ;(this.initialize(), i.release(), (i = void 0), (i = null))
      }
      stabilization(t) {
        var e, i, s, r
        let a, n, o, l
        const u = new re()
        let h, g, d, c, _, m, p, f
        ;((_ = t.getModel().parameters.values),
          (m = t.getModel().parameters.maximumValues),
          (p = t.getModel().parameters.minimumValues),
          (f = t.getModel().parameters.defaultValues),
          (null !==
            (i = null === (e = this._parameterCaches) || void 0 === e ? void 0 : e.length) &&
          void 0 !== i
            ? i
            : 0) < t.getParameterCount() &&
            (this._parameterCaches = new Float32Array(t.getParameterCount())),
          (null !==
            (r = null === (s = this._parameterInputCaches) || void 0 === s ? void 0 : s.length) &&
          void 0 !== r
            ? r
            : 0) < t.getParameterCount() &&
            (this._parameterInputCaches = new Float32Array(t.getParameterCount())))
        for (let e = 0; e < t.getParameterCount(); ++e)
          ((this._parameterCaches[e] = _[e]), (this._parameterInputCaches[e] = _[e]))
        for (let e = 0; e < this._physicsRig.subRigCount; ++e) {
          ;((a = { angle: 0 }),
            (u.x = 0),
            (u.y = 0),
            (h = this._physicsRig.settings.at(e)),
            (g = this._physicsRig.inputs.get(h.baseInputIndex)),
            (d = this._physicsRig.outputs.get(h.baseOutputIndex)),
            (c = this._physicsRig.particles.get(h.baseParticleIndex)))
          for (let e = 0; e < h.inputCount; ++e)
            ((n = g[e].weight / 100),
              -1 == g[e].sourceParameterIndex &&
                (g[e].sourceParameterIndex = t.getParameterIndex(g[e].source.id)),
              g[e].getNormalizedParameterValue(
                u,
                a,
                _[g[e].sourceParameterIndex],
                p[g[e].sourceParameterIndex],
                m[g[e].sourceParameterIndex],
                f[g[e].sourceParameterIndex],
                h.normalizationPosition,
                h.normalizationAngle,
                g[e].reflect,
                n
              ),
              (this._parameterCaches[g[e].sourceParameterIndex] = _[g[e].sourceParameterIndex]))
          ;((o = ae.degreesToRadian(-a.angle)),
            (u.x = u.x * ae.cos(o) - u.y * ae.sin(o)),
            (u.y = u.x * ae.sin(o) + u.y * ae.cos(o)),
            Oi(
              c,
              h.particleCount,
              u,
              a.angle,
              this._options.wind,
              0.001 * h.normalizationPosition.maximum
            ))
          for (let i = 0; i < h.outputCount; ++i) {
            const s = d[i].vertexIndex
            if (
              (-1 == d[i].destinationParameterIndex &&
                (d[i].destinationParameterIndex = t.getParameterIndex(d[i].destination.id)),
              s < 1 || s >= h.particleCount)
            )
              continue
            let r = new re()
            ;((r = c[s].position.substract(c[s - 1].position)),
              (l = d[i].getValue(r, c, s, d[i].reflect, this._options.gravity)),
              this._currentRigOutputs.at(e).outputs.set(i, l),
              this._previousRigOutputs.at(e).outputs.set(i, l))
            const a = d[i].destinationParameterIndex,
              n =
                !Float32Array.prototype.slice && 'subarray' in Float32Array.prototype
                  ? JSON.parse(JSON.stringify(_.subarray(a)))
                  : _.slice(a)
            Ni(n, p[a], m[a], l, d[i])
            for (let t = a, e = 0; t < this._parameterCaches.length; t++, e++)
              _[t] = this._parameterCaches[t] = n[e]
          }
        }
      }
      evaluate(t, e) {
        var i, s, r, a
        let n, o, l, u
        const h = new re()
        let g, d, c, _, m, p, f, y, S
        if (0 >= e) return
        if (
          ((this._currentRemainTime += e),
          this._currentRemainTime > 5 && (this._currentRemainTime = 0),
          (m = t.getModel().parameters.values),
          (p = t.getModel().parameters.maximumValues),
          (f = t.getModel().parameters.minimumValues),
          (y = t.getModel().parameters.defaultValues),
          (null !==
            (s = null === (i = this._parameterCaches) || void 0 === i ? void 0 : i.length) &&
          void 0 !== s
            ? s
            : 0) < t.getParameterCount() &&
            (this._parameterCaches = new Float32Array(t.getParameterCount())),
          (null !==
            (a = null === (r = this._parameterInputCaches) || void 0 === r ? void 0 : r.length) &&
          void 0 !== a
            ? a
            : 0) < t.getParameterCount())
        ) {
          this._parameterInputCaches = new Float32Array(t.getParameterCount())
          for (let e = 0; e < t.getParameterCount(); ++e) this._parameterInputCaches[e] = m[e]
        }
        for (
          S = this._physicsRig.fps > 0 ? 1 / this._physicsRig.fps : e;
          this._currentRemainTime >= S;

        ) {
          for (let t = 0; t < this._physicsRig.subRigCount; ++t) {
            ;((g = this._physicsRig.settings.at(t)),
              (c = this._physicsRig.outputs.get(g.baseOutputIndex)))
            for (let e = 0; e < g.outputCount; ++e)
              this._previousRigOutputs
                .at(t)
                .outputs.set(e, this._currentRigOutputs.at(t).outputs.at(e))
          }
          const e = S / this._currentRemainTime
          for (let i = 0; i < t.getParameterCount(); ++i)
            ((this._parameterCaches[i] = this._parameterInputCaches[i] * (1 - e) + m[i] * e),
              (this._parameterInputCaches[i] = this._parameterCaches[i]))
          for (let e = 0; e < this._physicsRig.subRigCount; ++e) {
            ;((n = { angle: 0 }),
              (h.x = 0),
              (h.y = 0),
              (g = this._physicsRig.settings.at(e)),
              (d = this._physicsRig.inputs.get(g.baseInputIndex)),
              (c = this._physicsRig.outputs.get(g.baseOutputIndex)),
              (_ = this._physicsRig.particles.get(g.baseParticleIndex)))
            for (let e = 0; e < g.inputCount; ++e)
              ((o = d[e].weight / 100),
                -1 == d[e].sourceParameterIndex &&
                  (d[e].sourceParameterIndex = t.getParameterIndex(d[e].source.id)),
                d[e].getNormalizedParameterValue(
                  h,
                  n,
                  this._parameterCaches[d[e].sourceParameterIndex],
                  f[d[e].sourceParameterIndex],
                  p[d[e].sourceParameterIndex],
                  y[d[e].sourceParameterIndex],
                  g.normalizationPosition,
                  g.normalizationAngle,
                  d[e].reflect,
                  o
                ))
            ;((l = ae.degreesToRadian(-n.angle)),
              (h.x = h.x * ae.cos(l) - h.y * ae.sin(l)),
              (h.y = h.x * ae.sin(l) + h.y * ae.cos(l)),
              ki(
                _,
                g.particleCount,
                h,
                n.angle,
                this._options.wind,
                0.001 * g.normalizationPosition.maximum,
                S,
                5
              ))
            for (let i = 0; i < g.outputCount; ++i) {
              const s = c[i].vertexIndex
              if (
                (-1 == c[i].destinationParameterIndex &&
                  (c[i].destinationParameterIndex = t.getParameterIndex(c[i].destination.id)),
                s < 1 || s >= g.particleCount)
              )
                continue
              const r = new re()
              ;((r.x = _[s].position.x - _[s - 1].position.x),
                (r.y = _[s].position.y - _[s - 1].position.y),
                (u = c[i].getValue(r, _, s, c[i].reflect, this._options.gravity)),
                this._currentRigOutputs.at(e).outputs.set(i, u))
              const a = c[i].destinationParameterIndex,
                n =
                  !Float32Array.prototype.slice && 'subarray' in Float32Array.prototype
                    ? JSON.parse(JSON.stringify(this._parameterCaches.subarray(a)))
                    : this._parameterCaches.slice(a)
              Ni(n, f[a], p[a], u, c[i])
              for (let t = a, e = 0; t < this._parameterCaches.length; t++, e++)
                this._parameterCaches[t] = n[e]
            }
          }
          this._currentRemainTime -= S
        }
        const x = this._currentRemainTime / S
        this.interpolate(t, x)
      }
      interpolate(t, e) {
        let i, s, r, a, n
        ;((r = t.getModel().parameters.values),
          (a = t.getModel().parameters.maximumValues),
          (n = t.getModel().parameters.minimumValues))
        for (let t = 0; t < this._physicsRig.subRigCount; ++t) {
          ;((s = this._physicsRig.settings.at(t)),
            (i = this._physicsRig.outputs.get(s.baseOutputIndex)))
          for (let o = 0; o < s.outputCount; ++o) {
            if (-1 == i[o].destinationParameterIndex) continue
            const s = i[o].destinationParameterIndex,
              l =
                !Float32Array.prototype.slice && 'subarray' in Float32Array.prototype
                  ? JSON.parse(JSON.stringify(r.subarray(s)))
                  : r.slice(s)
            Ni(
              l,
              n[s],
              a[s],
              this._previousRigOutputs.at(t).outputs.at(o) * (1 - e) +
                this._currentRigOutputs.at(t).outputs.at(o) * e,
              i[o]
            )
            for (let t = s, e = 0; t < r.length; t++, e++) r[t] = l[e]
          }
        }
      }
      setOptions(t) {
        this._options = t
      }
      getOption() {
        return this._options
      }
      constructor() {
        ;((this._physicsRig = null),
          (this._options = new vi()),
          (this._options.gravity.y = -1),
          (this._options.gravity.x = 0),
          (this._options.wind.x = 0),
          (this._options.wind.y = 0),
          (this._currentRigOutputs = new u()),
          (this._previousRigOutputs = new u()),
          (this._currentRemainTime = 0),
          (this._parameterCaches = null),
          (this._parameterInputCaches = null))
      }
      release() {
        ;((this._physicsRig = void 0), (this._physicsRig = null))
      }
      initialize() {
        let t, e, i
        for (let s = 0; s < this._physicsRig.subRigCount; ++s) {
          ;((e = this._physicsRig.settings.at(s)),
            (t = this._physicsRig.particles.get(e.baseParticleIndex)),
            (t[0].initialPosition = new re(0, 0)),
            (t[0].lastPosition = new re(t[0].initialPosition.x, t[0].initialPosition.y)),
            (t[0].lastGravity = new re(0, -1)),
            (t[0].lastGravity.y *= -1),
            (t[0].velocity = new re(0, 0)),
            (t[0].force = new re(0, 0)))
          for (let s = 1; s < e.particleCount; ++s)
            ((i = new re(0, 0)),
              (i.y = t[s].radius),
              (t[s].initialPosition = new re(
                t[s - 1].initialPosition.x + i.x,
                t[s - 1].initialPosition.y + i.y
              )),
              (t[s].position = new re(t[s].initialPosition.x, t[s].initialPosition.y)),
              (t[s].lastPosition = new re(t[s].initialPosition.x, t[s].initialPosition.y)),
              (t[s].lastGravity = new re(0, -1)),
              (t[s].lastGravity.y *= -1),
              (t[s].velocity = new re(0, 0)),
              (t[s].force = new re(0, 0)))
        }
      }
    }
    class vi {
      constructor() {
        ;((this.gravity = new re(0, 0)), (this.wind = new re(0, 0)))
      }
    }
    class wi {
      constructor() {
        this.outputs = new u(0)
      }
    }
    function Ii(t, e, i, s, r, a, n, o, l, u) {
      t.x += Ui(i, s, r, 0, n.minimum, n.maximum, n.defalut, l) * u
    }
    function Ti(t, e, i, s, r, a, n, o, l, u) {
      t.y += Ui(i, s, r, 0, n.minimum, n.maximum, n.defalut, l) * u
    }
    function Vi(t, e, i, s, r, a, n, o, l, u) {
      e.angle += Ui(i, s, r, 0, o.minimum, o.maximum, o.defalut, l) * u
    }
    function Ri(t, e, i, s, r) {
      let a = t.x
      return (s && (a *= -1), a)
    }
    function Ei(t, e, i, s, r) {
      let a = t.y
      return (s && (a *= -1), a)
    }
    function Fi(t, e, i, s, r) {
      let a
      return (
        (r = i >= 2 ? e[i - 1].position.substract(e[i - 2].position) : r.multiplyByScaler(-1)),
        (a = ae.directionToRadian(r, t)),
        s && (a *= -1),
        a
      )
    }
    function Li(t, e) {
      return JSON.parse(JSON.stringify(t.x))
    }
    function Ai(t, e) {
      return JSON.parse(JSON.stringify(t.y))
    }
    function Di(t, e) {
      return JSON.parse(JSON.stringify(e))
    }
    function ki(t, e, i, s, r, a, n, o) {
      let l,
        u,
        h,
        g,
        d = new re(0, 0),
        c = new re(0, 0),
        _ = new re(0, 0),
        m = new re(0, 0)
      ;((t[0].position = new re(i.x, i.y)),
        (l = ae.degreesToRadian(s)),
        (g = ae.radianToDirection(l)),
        g.normalize())
      for (let i = 1; i < e; ++i)
        ((t[i].force = g.multiplyByScaler(t[i].acceleration).add(r)),
          (t[i].lastPosition = new re(t[i].position.x, t[i].position.y)),
          (u = t[i].delay * n * 30),
          (d = t[i].position.substract(t[i - 1].position)),
          (h = ae.directionToRadian(t[i].lastGravity, g) / o),
          (d.x = ae.cos(h) * d.x - d.y * ae.sin(h)),
          (d.y = ae.sin(h) * d.x + d.y * ae.cos(h)),
          (t[i].position = t[i - 1].position.add(d)),
          (c = t[i].velocity.multiplyByScaler(u)),
          (_ = t[i].force.multiplyByScaler(u).multiplyByScaler(u)),
          (t[i].position = t[i].position.add(c).add(_)),
          (m = t[i].position.substract(t[i - 1].position)),
          m.normalize(),
          (t[i].position = t[i - 1].position.add(m.multiplyByScaler(t[i].radius))),
          ae.abs(t[i].position.x) < a && (t[i].position.x = 0),
          0 != u &&
            ((t[i].velocity = t[i].position.substract(t[i].lastPosition)),
            (t[i].velocity = t[i].velocity.divisionByScalar(u)),
            (t[i].velocity = t[i].velocity.multiplyByScaler(t[i].mobility))),
          (t[i].force = new re(0, 0)),
          (t[i].lastGravity = new re(g.x, g.y)))
    }
    function Oi(t, e, i, s, r, a) {
      let n,
        o,
        l = new re(0, 0)
      ;((t[0].position = new re(i.x, i.y)),
        (n = ae.degreesToRadian(s)),
        (o = ae.radianToDirection(n)),
        o.normalize())
      for (let i = 1; i < e; ++i)
        ((t[i].force = o.multiplyByScaler(t[i].acceleration).add(r)),
          (t[i].lastPosition = new re(t[i].position.x, t[i].position.y)),
          (t[i].velocity = new re(0, 0)),
          (l = t[i].force),
          l.normalize(),
          (l = l.multiplyByScaler(t[i].radius)),
          (t[i].position = t[i - 1].position.add(l)),
          ae.abs(t[i].position.x) < a && (t[i].position.x = 0),
          (t[i].force = new re(0, 0)),
          (t[i].lastGravity = new re(o.x, o.y)))
    }
    function Ni(t, e, i, s, r) {
      let a, n, o
      ;((a = r.getScale(r.translationScale, r.angleScale)),
        (n = s * a),
        n < e
          ? (n < r.valueBelowMinimum && (r.valueBelowMinimum = n), (n = e))
          : n > i && (n > r.valueExceededMaximum && (r.valueExceededMaximum = n), (n = i)),
        (o = r.weight / 100),
        o >= 1 || (n = t[0] * (1 - o) + n * o),
        (t[0] = n))
    }
    function Ui(t, e, i, s, r, a, n, o) {
      let l = 0
      const u = ae.max(i, e)
      u < t && (t = u)
      const h = ae.min(i, e)
      h > t && (t = h)
      const g = ae.min(r, a),
        d = ae.max(r, a),
        c = n,
        _ =
          ((p = h),
          (f = u),
          ae.min(p, f) +
            (function (t, e) {
              const i = ae.max(t, e),
                s = ae.min(t, e)
              return ae.abs(i - s)
            })(p, f) /
              2),
        m = t - _
      var p, f
      switch (
        (function (t) {
          let e = 0
          return (t > 0 ? (e = 1) : t < 0 && (e = -1), e)
        })(m)
      ) {
        case 1: {
          const t = u - _
          0 != t && ((l = m * ((d - c) / t)), (l += c))
          break
        }
        case -1: {
          const t = h - _
          0 != t && ((l = m * ((g - c) / t)), (l += c))
          break
        }
        case 0:
          l = c
      }
      return o ? l : -1 * l
    }
    var zi, ji
    !(function (t) {
      ;((t.CubismPhysics = Pi), (t.Options = vi))
    })(zi || (zi = {}))
    class Xi {
      constructor(t, e, i, s) {
        ;((this.x = t), (this.y = e), (this.width = i), (this.height = s))
      }
      getCenterX() {
        return this.x + 0.5 * this.width
      }
      getCenterY() {
        return this.y + 0.5 * this.height
      }
      getRight() {
        return this.x + this.width
      }
      getBottom() {
        return this.y + this.height
      }
      setRect(t) {
        ;((this.x = t.x), (this.y = t.y), (this.width = t.width), (this.height = t.height))
      }
      expand(t, e) {
        ;((this.x -= t), (this.y -= e), (this.width += 2 * t), (this.height += 2 * e))
      }
    }
    let Gi, Yi, Hi
    !(function (t) {
      t.csmRect = Xi
    })(ji || (ji = {}))
    class qi {
      getChannelFlagAsColor(t) {
        return this._channelColors.at(t)
      }
      getMaskRenderTexture() {
        if (this._maskTexture && null != this._maskTexture.textures)
          this._maskTexture.frameNo = this._currentFrameNo
        else {
          ;(null != this._maskRenderTextures && this._maskRenderTextures.clear(),
            (this._maskRenderTextures = new u()),
            null != this._maskColorBuffers && this._maskColorBuffers.clear(),
            (this._maskColorBuffers = new u()))
          const t = this._clippingMaskBufferSize
          for (let e = 0; e < this._renderTextureCount; e++)
            (this._maskColorBuffers.pushBack(this.gl.createTexture()),
              this.gl.bindTexture(this.gl.TEXTURE_2D, this._maskColorBuffers.at(e)),
              this.gl.texImage2D(
                this.gl.TEXTURE_2D,
                0,
                this.gl.RGBA,
                t,
                t,
                0,
                this.gl.RGBA,
                this.gl.UNSIGNED_BYTE,
                null
              ),
              this.gl.texParameteri(
                this.gl.TEXTURE_2D,
                this.gl.TEXTURE_WRAP_S,
                this.gl.CLAMP_TO_EDGE
              ),
              this.gl.texParameteri(
                this.gl.TEXTURE_2D,
                this.gl.TEXTURE_WRAP_T,
                this.gl.CLAMP_TO_EDGE
              ),
              this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR),
              this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR),
              this.gl.bindTexture(this.gl.TEXTURE_2D, null),
              this._maskRenderTextures.pushBack(this.gl.createFramebuffer()),
              this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this._maskRenderTextures.at(e)),
              this.gl.framebufferTexture2D(
                this.gl.FRAMEBUFFER,
                this.gl.COLOR_ATTACHMENT0,
                this.gl.TEXTURE_2D,
                this._maskColorBuffers.at(e),
                0
              ))
          ;(this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, Hi),
            (this._maskTexture = new Wi(this._currentFrameNo, this._maskRenderTextures)))
        }
        return this._maskTexture.textures
      }
      setGL(t) {
        this.gl = t
      }
      calcClippedDrawTotalBounds(t, e) {
        let i = Number.MAX_VALUE,
          s = Number.MAX_VALUE,
          r = Number.MIN_VALUE,
          a = Number.MIN_VALUE
        const n = e._clippedDrawableIndexList.length
        for (let o = 0; o < n; o++) {
          const n = e._clippedDrawableIndexList[o],
            l = t.getDrawableVertexCount(n),
            u = t.getDrawableVertices(n)
          let h = Number.MAX_VALUE,
            g = Number.MAX_VALUE,
            d = -Number.MAX_VALUE,
            c = -Number.MAX_VALUE
          const _ = l * q.vertexStep
          for (let t = q.vertexOffset; t < _; t += q.vertexStep) {
            const e = u[t],
              i = u[t + 1]
            ;(e < h && (h = e), e > d && (d = e), i < g && (g = i), i > c && (c = i))
          }
          if (h != Number.MAX_VALUE)
            if (
              (h < i && (i = h),
              g < s && (s = g),
              d > r && (r = d),
              c > a && (a = c),
              i == Number.MAX_VALUE)
            )
              ((e._allClippedDrawRect.x = 0),
                (e._allClippedDrawRect.y = 0),
                (e._allClippedDrawRect.width = 0),
                (e._allClippedDrawRect.height = 0),
                (e._isUsing = !1))
            else {
              e._isUsing = !0
              const t = r - i,
                n = a - s
              ;((e._allClippedDrawRect.x = i),
                (e._allClippedDrawRect.y = s),
                (e._allClippedDrawRect.width = t),
                (e._allClippedDrawRect.height = n))
            }
        }
      }
      constructor() {
        ;((this._currentMaskRenderTexture = null),
          (this._maskColorBuffers = null),
          (this._currentFrameNo = 0),
          (this._renderTextureCount = 0),
          (this._clippingMaskBufferSize = 256),
          (this._clippingContextListForMask = new u()),
          (this._clippingContextListForDraw = new u()),
          (this._channelColors = new u()),
          (this._tmpBoundsOnModel = new Xi()),
          (this._tmpMatrix = new _()),
          (this._tmpMatrixForMask = new _()),
          (this._tmpMatrixForDraw = new _()),
          (this._maskTexture = null))
        let t = new p()
        ;((t.R = 1),
          (t.G = 0),
          (t.B = 0),
          (t.A = 0),
          this._channelColors.pushBack(t),
          (t = new p()),
          (t.R = 0),
          (t.G = 1),
          (t.B = 0),
          (t.A = 0),
          this._channelColors.pushBack(t),
          (t = new p()),
          (t.R = 0),
          (t.G = 0),
          (t.B = 1),
          (t.A = 0),
          this._channelColors.pushBack(t),
          (t = new p()),
          (t.R = 0),
          (t.G = 0),
          (t.B = 0),
          (t.A = 1),
          this._channelColors.pushBack(t))
      }
      release() {
        for (let t = 0; t < this._clippingContextListForMask.getSize(); t++)
          (this._clippingContextListForMask.at(t) &&
            (this._clippingContextListForMask.at(t).release(),
            this._clippingContextListForMask.set(t, void 0)),
            this._clippingContextListForMask.set(t, null))
        this._clippingContextListForMask = null
        for (let t = 0; t < this._clippingContextListForDraw.getSize(); t++)
          this._clippingContextListForDraw.set(t, null)
        if (((this._clippingContextListForDraw = null), this._maskTexture)) {
          for (let t = 0; t < this._maskTexture.textures.getSize(); t++)
            this.gl.deleteFramebuffer(this._maskTexture.textures.at(t))
          ;(this._maskTexture.textures.clear(),
            (this._maskTexture.textures = null),
            (this._maskTexture = null))
        }
        for (let t = 0; t < this._channelColors.getSize(); t++) this._channelColors.set(t, null)
        if (((this._channelColors = null), null != this._maskColorBuffers)) {
          for (let t = 0; t < this._maskColorBuffers.getSize(); t++)
            this.gl.deleteTexture(this._maskColorBuffers.at(t))
          this._maskColorBuffers.clear()
        }
        ;((this._maskColorBuffers = null),
          null != this._maskRenderTextures && this._maskRenderTextures.clear(),
          (this._maskRenderTextures = null),
          null != this._clearedFrameBufferflags && this._clearedFrameBufferflags.clear(),
          (this._clearedFrameBufferflags = null))
      }
      initialize(t, e, i, s, r) {
        ;(r % 1 != 0 &&
          (B(
            'The number of render textures must be specified as an integer. The decimal point is rounded down and corrected to an integer.'
          ),
          (r = ~~r)),
          r < 1 &&
            B(
              'The number of render textures must be an integer greater than or equal to 1. Set the number of render textures to 1.'
            ),
          (this._renderTextureCount = r < 1 ? 1 : r),
          (this._clearedFrameBufferflags = new u(this._renderTextureCount)))
        for (let t = 0; t < e; t++) {
          if (s[t] <= 0) {
            this._clippingContextListForDraw.pushBack(null)
            continue
          }
          let e = this.findSameClip(i[t], s[t])
          ;(null == e &&
            ((e = new Ji(this, i[t], s[t])), this._clippingContextListForMask.pushBack(e)),
            e.addClippedDrawable(t),
            this._clippingContextListForDraw.pushBack(e))
        }
      }
      setupClippingContext(t, e) {
        this._currentFrameNo++
        let i = 0
        for (let e = 0; e < this._clippingContextListForMask.getSize(); e++) {
          const s = this._clippingContextListForMask.at(e)
          ;(this.calcClippedDrawTotalBounds(t, s), s._isUsing && i++)
        }
        if (i > 0) {
          ;(this.setupLayoutBounds(e.isUsingHighPrecisionMask() ? 0 : i),
            e.isUsingHighPrecisionMask() ||
              (this.gl.viewport(0, 0, this._clippingMaskBufferSize, this._clippingMaskBufferSize),
              (this._currentMaskRenderTexture = this.getMaskRenderTexture().at(0)),
              e.preDraw(),
              this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this._currentMaskRenderTexture)),
            this._clearedFrameBufferflags.getSize() != this._renderTextureCount &&
              (this._clearedFrameBufferflags.clear(),
              (this._clearedFrameBufferflags = new u(this._renderTextureCount))))
          for (let t = 0; t < this._clearedFrameBufferflags.getSize(); t++)
            this._clearedFrameBufferflags.set(t, !1)
          for (let i = 0; i < this._clippingContextListForMask.getSize(); i++) {
            const s = this._clippingContextListForMask.at(i),
              r = s._allClippedDrawRect,
              n = s._layoutBounds,
              o = 0.05
            let l = 0,
              u = 0
            const h = this.getMaskRenderTexture().at(s._bufferIndex)
            if (
              (this._currentMaskRenderTexture == h ||
                e.isUsingHighPrecisionMask() ||
                ((this._currentMaskRenderTexture = h),
                e.preDraw(),
                this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this._currentMaskRenderTexture)),
              e.isUsingHighPrecisionMask())
            ) {
              const e = t.getPixelsPerUnit(),
                i = s.getClippingManager()._clippingMaskBufferSize,
                a = n.width * i,
                h = n.height * i
              ;(this._tmpBoundsOnModel.setRect(r),
                this._tmpBoundsOnModel.width * e > a
                  ? (this._tmpBoundsOnModel.expand(r.width * o, 0),
                    (l = n.width / this._tmpBoundsOnModel.width))
                  : (l = e / a),
                this._tmpBoundsOnModel.height * e > h
                  ? (this._tmpBoundsOnModel.expand(0, r.height * o),
                    (u = n.height / this._tmpBoundsOnModel.height))
                  : (u = e / h))
            } else
              (this._tmpBoundsOnModel.setRect(r),
                this._tmpBoundsOnModel.expand(r.width * o, r.height * o),
                (l = n.width / this._tmpBoundsOnModel.width),
                (u = n.height / this._tmpBoundsOnModel.height))
            if (
              (this._tmpMatrix.loadIdentity(),
              this._tmpMatrix.translateRelative(-1, -1),
              this._tmpMatrix.scaleRelative(2, 2),
              this._tmpMatrix.translateRelative(n.x, n.y),
              this._tmpMatrix.scaleRelative(l, u),
              this._tmpMatrix.translateRelative(
                -this._tmpBoundsOnModel.x,
                -this._tmpBoundsOnModel.y
              ),
              this._tmpMatrixForMask.setMatrix(this._tmpMatrix.getArray()),
              this._tmpMatrix.loadIdentity(),
              this._tmpMatrix.translateRelative(n.x, n.y),
              this._tmpMatrix.scaleRelative(l, u),
              this._tmpMatrix.translateRelative(
                -this._tmpBoundsOnModel.x,
                -this._tmpBoundsOnModel.y
              ),
              this._tmpMatrixForDraw.setMatrix(this._tmpMatrix.getArray()),
              s._matrixForMask.setMatrix(this._tmpMatrixForMask.getArray()),
              s._matrixForDraw.setMatrix(this._tmpMatrixForDraw.getArray()),
              !e.isUsingHighPrecisionMask())
            ) {
              const i = s._clippingIdCount
              for (let r = 0; r < i; r++) {
                const i = s._clippingIdList[r]
                t.getDrawableDynamicFlagVertexPositionsDidChange(i) &&
                  (e.setIsCulling(0 != t.getDrawableCulling(i)),
                  this._clearedFrameBufferflags.at(s._bufferIndex) ||
                    (this.gl.clearColor(1, 1, 1, 1),
                    this.gl.clear(this.gl.COLOR_BUFFER_BIT),
                    this._clearedFrameBufferflags.set(s._bufferIndex, !0)),
                  e.setClippingContextBufferForMask(s),
                  e.drawMesh(
                    t.getDrawableTextureIndex(i),
                    t.getDrawableVertexIndexCount(i),
                    t.getDrawableVertexCount(i),
                    t.getDrawableVertexIndices(i),
                    t.getDrawableVertices(i),
                    t.getDrawableVertexUvs(i),
                    t.getMultiplyColor(i),
                    t.getScreenColor(i),
                    t.getDrawableOpacity(i),
                    a.CubismBlendMode_Normal,
                    !1
                  ))
              }
            }
          }
          e.isUsingHighPrecisionMask() ||
            (this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, Hi),
            e.setClippingContextBufferForMask(null),
            this.gl.viewport(Yi[0], Yi[1], Yi[2], Yi[3]))
        }
      }
      findSameClip(t, e) {
        for (let i = 0; i < this._clippingContextListForMask.getSize(); i++) {
          const s = this._clippingContextListForMask.at(i),
            r = s._clippingIdCount
          if (r != e) continue
          let a = 0
          for (let e = 0; e < r; e++) {
            const i = s._clippingIdList[e]
            for (let e = 0; e < r; e++)
              if (t[e] == i) {
                a++
                break
              }
          }
          if (a == r) return s
        }
        return null
      }
      setupLayoutBounds(t) {
        const e = this._renderTextureCount <= 1 ? 36 : 32 * this._renderTextureCount
        if (t <= 0 || t > e) {
          t > e &&
            M(
              'not supported mask count : {0}\n[Details] render texture count : {1}, mask count : {2}',
              t - e,
              this._renderTextureCount,
              t
            )
          for (let t = 0; t < this._clippingContextListForMask.getSize(); t++) {
            const e = this._clippingContextListForMask.at(t)
            ;((e._layoutChannelNo = 0),
              (e._layoutBounds.x = 0),
              (e._layoutBounds.y = 0),
              (e._layoutBounds.width = 1),
              (e._layoutBounds.height = 1),
              (e._bufferIndex = 0))
          }
          return
        }
        const i = this._renderTextureCount <= 1 ? 9 : 8
        let s = t / this._renderTextureCount,
          r = t % this._renderTextureCount
        ;((s = ~~s), (r = ~~r))
        let a = s / 4,
          n = s % 4
        ;((a = ~~a), (n = ~~n))
        let o = 0
        for (let s = 0; s < this._renderTextureCount; s++)
          for (let l = 0; l < 4; l++) {
            let u = a + (l < n ? 1 : 0)
            if ((u < i && l == (n + 1 >= 4 ? 0 : n + 1) && (u += s < r ? 1 : 0), 0 == u));
            else if (1 == u) {
              const t = this._clippingContextListForMask.at(o++)
              ;((t._layoutChannelNo = l),
                (t._layoutBounds.x = 0),
                (t._layoutBounds.y = 0),
                (t._layoutBounds.width = 1),
                (t._layoutBounds.height = 1),
                (t._bufferIndex = s))
            } else if (2 == u)
              for (let t = 0; t < u; t++) {
                let e = t % 2
                e = ~~e
                const i = this._clippingContextListForMask.at(o++)
                ;((i._layoutChannelNo = l),
                  (i._layoutBounds.x = 0.5 * e),
                  (i._layoutBounds.y = 0),
                  (i._layoutBounds.width = 0.5),
                  (i._layoutBounds.height = 1),
                  (i._bufferIndex = s))
              }
            else if (u <= 4)
              for (let t = 0; t < u; t++) {
                let e = t % 2,
                  i = t / 2
                ;((e = ~~e), (i = ~~i))
                const r = this._clippingContextListForMask.at(o++)
                ;((r._layoutChannelNo = l),
                  (r._layoutBounds.x = 0.5 * e),
                  (r._layoutBounds.y = 0.5 * i),
                  (r._layoutBounds.width = 0.5),
                  (r._layoutBounds.height = 0.5),
                  (r._bufferIndex = s))
              }
            else if (u <= i)
              for (let t = 0; t < u; t++) {
                let e = t % 3,
                  i = t / 3
                ;((e = ~~e), (i = ~~i))
                const r = this._clippingContextListForMask.at(o++)
                ;((r._layoutChannelNo = l),
                  (r._layoutBounds.x = e / 3),
                  (r._layoutBounds.y = i / 3),
                  (r._layoutBounds.width = 1 / 3),
                  (r._layoutBounds.height = 1 / 3),
                  (r._bufferIndex = s))
              }
            else {
              M(
                'not supported mask count : {0}\n[Details] render texture count : {1}, mask count : {2}',
                t - e,
                this._renderTextureCount,
                t
              )
              for (let t = 0; t < u; t++) {
                const t = this._clippingContextListForMask.at(o++)
                ;((t._layoutChannelNo = 0),
                  (t._layoutBounds.x = 0),
                  (t._layoutBounds.y = 0),
                  (t._layoutBounds.width = 1),
                  (t._layoutBounds.height = 1),
                  (t._bufferIndex = 0))
              }
            }
          }
      }
      getColorBuffer() {
        return this._maskColorBuffers
      }
      getClippingContextListForDraw() {
        return this._clippingContextListForDraw
      }
      getClippingMaskCount() {
        return this._clippingContextListForMask.getSize()
      }
      setClippingMaskBufferSize(t) {
        this._clippingMaskBufferSize = t
      }
      getClippingMaskBufferSize() {
        return this._clippingMaskBufferSize
      }
      getRenderTextureCount() {
        return this._renderTextureCount
      }
    }
    class Wi {
      constructor(t, e) {
        ;((this.frameNo = t), (this.textures = e))
      }
    }
    class Ji {
      constructor(t, e, i) {
        ;((this._owner = t),
          (this._clippingIdList = e),
          (this._clippingIdCount = i),
          (this._allClippedDrawRect = new Xi()),
          (this._layoutBounds = new Xi()),
          (this._clippedDrawableIndexList = []),
          (this._matrixForMask = new _()),
          (this._matrixForDraw = new _()),
          (this._bufferIndex = 0))
      }
      release() {
        ;(null != this._layoutBounds && (this._layoutBounds = null),
          null != this._allClippedDrawRect && (this._allClippedDrawRect = null),
          null != this._clippedDrawableIndexList && (this._clippedDrawableIndexList = null))
      }
      addClippedDrawable(t) {
        this._clippedDrawableIndexList.push(t)
      }
      getClippingManager() {
        return this._owner
      }
      setGl(t) {
        this._owner.setGL(t)
      }
    }
    class $i {
      setGlEnable(t, e) {
        e ? this.gl.enable(t) : this.gl.disable(t)
      }
      setGlEnableVertexAttribArray(t, e) {
        e ? this.gl.enableVertexAttribArray(t) : this.gl.disableVertexAttribArray(t)
      }
      save() {
        null != this.gl
          ? ((this._lastArrayBufferBinding = this.gl.getParameter(this.gl.ARRAY_BUFFER_BINDING)),
            (this._lastArrayBufferBinding = this.gl.getParameter(
              this.gl.ELEMENT_ARRAY_BUFFER_BINDING
            )),
            (this._lastProgram = this.gl.getParameter(this.gl.CURRENT_PROGRAM)),
            (this._lastActiveTexture = this.gl.getParameter(this.gl.ACTIVE_TEXTURE)),
            this.gl.activeTexture(this.gl.TEXTURE1),
            (this._lastTexture1Binding2D = this.gl.getParameter(this.gl.TEXTURE_BINDING_2D)),
            this.gl.activeTexture(this.gl.TEXTURE0),
            (this._lastTexture0Binding2D = this.gl.getParameter(this.gl.TEXTURE_BINDING_2D)),
            (this._lastVertexAttribArrayEnabled[0] = this.gl.getVertexAttrib(
              0,
              this.gl.VERTEX_ATTRIB_ARRAY_ENABLED
            )),
            (this._lastVertexAttribArrayEnabled[1] = this.gl.getVertexAttrib(
              1,
              this.gl.VERTEX_ATTRIB_ARRAY_ENABLED
            )),
            (this._lastVertexAttribArrayEnabled[2] = this.gl.getVertexAttrib(
              2,
              this.gl.VERTEX_ATTRIB_ARRAY_ENABLED
            )),
            (this._lastVertexAttribArrayEnabled[3] = this.gl.getVertexAttrib(
              3,
              this.gl.VERTEX_ATTRIB_ARRAY_ENABLED
            )),
            (this._lastScissorTest = this.gl.isEnabled(this.gl.SCISSOR_TEST)),
            (this._lastStencilTest = this.gl.isEnabled(this.gl.STENCIL_TEST)),
            (this._lastDepthTest = this.gl.isEnabled(this.gl.DEPTH_TEST)),
            (this._lastCullFace = this.gl.isEnabled(this.gl.CULL_FACE)),
            (this._lastBlend = this.gl.isEnabled(this.gl.BLEND)),
            (this._lastFrontFace = this.gl.getParameter(this.gl.FRONT_FACE)),
            (this._lastColorMask = this.gl.getParameter(this.gl.COLOR_WRITEMASK)),
            (this._lastBlending[0] = this.gl.getParameter(this.gl.BLEND_SRC_RGB)),
            (this._lastBlending[1] = this.gl.getParameter(this.gl.BLEND_DST_RGB)),
            (this._lastBlending[2] = this.gl.getParameter(this.gl.BLEND_SRC_ALPHA)),
            (this._lastBlending[3] = this.gl.getParameter(this.gl.BLEND_DST_ALPHA)),
            (this._lastFBO = this.gl.getParameter(this.gl.FRAMEBUFFER_BINDING)),
            (this._lastViewport = this.gl.getParameter(this.gl.VIEWPORT)))
          : M(
              "'gl' is null. WebGLRenderingContext is required.\nPlease call 'CubimRenderer_WebGL.startUp' function."
            )
      }
      restore() {
        null != this.gl
          ? (this.gl.useProgram(this._lastProgram),
            this.setGlEnableVertexAttribArray(0, this._lastVertexAttribArrayEnabled[0]),
            this.setGlEnableVertexAttribArray(1, this._lastVertexAttribArrayEnabled[1]),
            this.setGlEnableVertexAttribArray(2, this._lastVertexAttribArrayEnabled[2]),
            this.setGlEnableVertexAttribArray(3, this._lastVertexAttribArrayEnabled[3]),
            this.setGlEnable(this.gl.SCISSOR_TEST, this._lastScissorTest),
            this.setGlEnable(this.gl.STENCIL_TEST, this._lastStencilTest),
            this.setGlEnable(this.gl.DEPTH_TEST, this._lastDepthTest),
            this.setGlEnable(this.gl.CULL_FACE, this._lastCullFace),
            this.setGlEnable(this.gl.BLEND, this._lastBlend),
            this.gl.frontFace(this._lastFrontFace),
            this.gl.colorMask(
              this._lastColorMask[0],
              this._lastColorMask[1],
              this._lastColorMask[2],
              this._lastColorMask[3]
            ),
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this._lastArrayBufferBinding),
            this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this._lastElementArrayBufferBinding),
            this.gl.activeTexture(this.gl.TEXTURE1),
            this.gl.bindTexture(this.gl.TEXTURE_2D, this._lastTexture1Binding2D),
            this.gl.activeTexture(this.gl.TEXTURE0),
            this.gl.bindTexture(this.gl.TEXTURE_2D, this._lastTexture0Binding2D),
            this.gl.activeTexture(this._lastActiveTexture),
            this.gl.blendFuncSeparate(
              this._lastBlending[0],
              this._lastBlending[1],
              this._lastBlending[2],
              this._lastBlending[3]
            ))
          : M(
              "'gl' is null. WebGLRenderingContext is required.\nPlease call 'CubimRenderer_WebGL.startUp' function."
            )
      }
      setGl(t) {
        this.gl = t
      }
      constructor() {
        ;((this._lastVertexAttribArrayEnabled = new Array(4)),
          (this._lastColorMask = new Array(4)),
          (this._lastBlending = new Array(4)),
          (this._lastViewport = new Array(4)))
      }
    }
    class Zi {
      static getInstance() {
        return null == Gi ? ((Gi = new Zi()), Gi) : Gi
      }
      static deleteInstance() {
        Gi && (Gi.release(), (Gi = null))
      }
      constructor() {
        this._shaderSets = new u()
      }
      release() {
        this.releaseShaderProgram()
      }
      setupShaderProgram(t, e, i, s, r, n, o, l, u, h, g, d, c, _, m) {
        let p, f, y, S
        if (
          (c || M('NoPremultipliedAlpha is not allowed'),
          0 == this._shaderSets.getSize() && this.generateShaders(),
          null != t.getClippingContextBufferForMask())
        ) {
          const i = this._shaderSets.at(Qi.ShaderNames_SetupMask)
          ;(this.gl.useProgram(i.shaderProgram),
            this.gl.activeTexture(this.gl.TEXTURE0),
            this.gl.bindTexture(this.gl.TEXTURE_2D, e),
            this.gl.uniform1i(i.samplerTexture0Location, 0),
            null == o.vertex && (o.vertex = this.gl.createBuffer()),
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, o.vertex),
            this.gl.bufferData(this.gl.ARRAY_BUFFER, s, this.gl.DYNAMIC_DRAW),
            this.gl.enableVertexAttribArray(i.attributePositionLocation),
            this.gl.vertexAttribPointer(i.attributePositionLocation, 2, this.gl.FLOAT, !1, 0, 0),
            null == o.uv && (o.uv = this.gl.createBuffer()),
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, o.uv),
            this.gl.bufferData(this.gl.ARRAY_BUFFER, n, this.gl.DYNAMIC_DRAW),
            this.gl.enableVertexAttribArray(i.attributeTexCoordLocation),
            this.gl.vertexAttribPointer(i.attributeTexCoordLocation, 2, this.gl.FLOAT, !1, 0, 0))
          const r = t.getClippingContextBufferForMask()._layoutChannelNo,
            a = t.getClippingContextBufferForMask().getClippingManager().getChannelFlagAsColor(r)
          ;(this.gl.uniform4f(i.uniformChannelFlagLocation, a.R, a.G, a.B, a.A),
            this.gl.uniformMatrix4fv(
              i.uniformClipMatrixLocation,
              !1,
              t.getClippingContextBufferForMask()._matrixForMask.getArray()
            ))
          const l = t.getClippingContextBufferForMask()._layoutBounds
          ;(this.gl.uniform4f(
            i.uniformBaseColorLocation,
            2 * l.x - 1,
            2 * l.y - 1,
            2 * l.getRight() - 1,
            2 * l.getBottom() - 1
          ),
            this.gl.uniform4f(i.uniformMultiplyColorLocation, g.R, g.G, g.B, g.A),
            this.gl.uniform4f(i.uniformScreenColorLocation, d.R, d.G, d.B, d.A),
            (p = this.gl.ZERO),
            (f = this.gl.ONE_MINUS_SRC_COLOR),
            (y = this.gl.ZERO),
            (S = this.gl.ONE_MINUS_SRC_ALPHA))
        } else {
          const i = null != t.getClippingContextBufferForDraw(),
            r = i ? (m ? 2 : 1) : 0
          let l = new Ki()
          switch (u) {
            case a.CubismBlendMode_Normal:
            default:
              ;((l = this._shaderSets.at(Qi.ShaderNames_NormalPremultipliedAlpha + r)),
                (p = this.gl.ONE),
                (f = this.gl.ONE_MINUS_SRC_ALPHA),
                (y = this.gl.ONE),
                (S = this.gl.ONE_MINUS_SRC_ALPHA))
              break
            case a.CubismBlendMode_Additive:
              ;((l = this._shaderSets.at(Qi.ShaderNames_AddPremultipliedAlpha + r)),
                (p = this.gl.ONE),
                (f = this.gl.ONE),
                (y = this.gl.ZERO),
                (S = this.gl.ONE))
              break
            case a.CubismBlendMode_Multiplicative:
              ;((l = this._shaderSets.at(Qi.ShaderNames_MultPremultipliedAlpha + r)),
                (p = this.gl.DST_COLOR),
                (f = this.gl.ONE_MINUS_SRC_ALPHA),
                (y = this.gl.ZERO),
                (S = this.gl.ONE))
          }
          if (
            (this.gl.useProgram(l.shaderProgram),
            null == o.vertex && (o.vertex = this.gl.createBuffer()),
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, o.vertex),
            this.gl.bufferData(this.gl.ARRAY_BUFFER, s, this.gl.DYNAMIC_DRAW),
            this.gl.enableVertexAttribArray(l.attributePositionLocation),
            this.gl.vertexAttribPointer(l.attributePositionLocation, 2, this.gl.FLOAT, !1, 0, 0),
            null == o.uv && (o.uv = this.gl.createBuffer()),
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, o.uv),
            this.gl.bufferData(this.gl.ARRAY_BUFFER, n, this.gl.DYNAMIC_DRAW),
            this.gl.enableVertexAttribArray(l.attributeTexCoordLocation),
            this.gl.vertexAttribPointer(l.attributeTexCoordLocation, 2, this.gl.FLOAT, !1, 0, 0),
            i)
          ) {
            this.gl.activeTexture(this.gl.TEXTURE1)
            const e = t
              .getClippingContextBufferForDraw()
              .getClippingManager()
              .getColorBuffer()
              .at(t.getClippingContextBufferForDraw()._bufferIndex)
            ;(this.gl.bindTexture(this.gl.TEXTURE_2D, e),
              this.gl.uniform1i(l.samplerTexture1Location, 1),
              this.gl.uniformMatrix4fv(
                l.uniformClipMatrixLocation,
                !1,
                t.getClippingContextBufferForDraw()._matrixForDraw.getArray()
              ))
            const i = t.getClippingContextBufferForDraw()._layoutChannelNo,
              s = t.getClippingContextBufferForDraw().getClippingManager().getChannelFlagAsColor(i)
            this.gl.uniform4f(l.uniformChannelFlagLocation, s.R, s.G, s.B, s.A)
          }
          ;(this.gl.activeTexture(this.gl.TEXTURE0),
            this.gl.bindTexture(this.gl.TEXTURE_2D, e),
            this.gl.uniform1i(l.samplerTexture0Location, 0),
            this.gl.uniformMatrix4fv(l.uniformMatrixLocation, !1, _.getArray()),
            this.gl.uniform4f(l.uniformBaseColorLocation, h.R, h.G, h.B, h.A),
            this.gl.uniform4f(l.uniformMultiplyColorLocation, g.R, g.G, g.B, g.A),
            this.gl.uniform4f(l.uniformScreenColorLocation, d.R, d.G, d.B, d.A))
        }
        ;(null == o.index && (o.index = this.gl.createBuffer()),
          this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, o.index),
          this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, r, this.gl.DYNAMIC_DRAW),
          this.gl.blendFuncSeparate(p, f, y, S))
      }
      releaseShaderProgram() {
        for (let t = 0; t < this._shaderSets.getSize(); t++)
          (this.gl.deleteProgram(this._shaderSets.at(t).shaderProgram),
            (this._shaderSets.at(t).shaderProgram = 0),
            this._shaderSets.set(t, void 0),
            this._shaderSets.set(t, null))
      }
      generateShaders() {
        for (let t = 0; t < 10; t++) this._shaderSets.pushBack(new Ki())
        ;((this._shaderSets.at(0).shaderProgram = this.loadShaderProgram(ts, es)),
          (this._shaderSets.at(1).shaderProgram = this.loadShaderProgram(is, rs)),
          (this._shaderSets.at(2).shaderProgram = this.loadShaderProgram(ss, as)),
          (this._shaderSets.at(3).shaderProgram = this.loadShaderProgram(ss, ns)),
          (this._shaderSets.at(4).shaderProgram = this._shaderSets.at(1).shaderProgram),
          (this._shaderSets.at(5).shaderProgram = this._shaderSets.at(2).shaderProgram),
          (this._shaderSets.at(6).shaderProgram = this._shaderSets.at(3).shaderProgram),
          (this._shaderSets.at(7).shaderProgram = this._shaderSets.at(1).shaderProgram),
          (this._shaderSets.at(8).shaderProgram = this._shaderSets.at(2).shaderProgram),
          (this._shaderSets.at(9).shaderProgram = this._shaderSets.at(3).shaderProgram),
          (this._shaderSets.at(0).attributePositionLocation = this.gl.getAttribLocation(
            this._shaderSets.at(0).shaderProgram,
            'a_position'
          )),
          (this._shaderSets.at(0).attributeTexCoordLocation = this.gl.getAttribLocation(
            this._shaderSets.at(0).shaderProgram,
            'a_texCoord'
          )),
          (this._shaderSets.at(0).samplerTexture0Location = this.gl.getUniformLocation(
            this._shaderSets.at(0).shaderProgram,
            's_texture0'
          )),
          (this._shaderSets.at(0).uniformClipMatrixLocation = this.gl.getUniformLocation(
            this._shaderSets.at(0).shaderProgram,
            'u_clipMatrix'
          )),
          (this._shaderSets.at(0).uniformChannelFlagLocation = this.gl.getUniformLocation(
            this._shaderSets.at(0).shaderProgram,
            'u_channelFlag'
          )),
          (this._shaderSets.at(0).uniformBaseColorLocation = this.gl.getUniformLocation(
            this._shaderSets.at(0).shaderProgram,
            'u_baseColor'
          )),
          (this._shaderSets.at(0).uniformMultiplyColorLocation = this.gl.getUniformLocation(
            this._shaderSets.at(0).shaderProgram,
            'u_multiplyColor'
          )),
          (this._shaderSets.at(0).uniformScreenColorLocation = this.gl.getUniformLocation(
            this._shaderSets.at(0).shaderProgram,
            'u_screenColor'
          )),
          (this._shaderSets.at(1).attributePositionLocation = this.gl.getAttribLocation(
            this._shaderSets.at(1).shaderProgram,
            'a_position'
          )),
          (this._shaderSets.at(1).attributeTexCoordLocation = this.gl.getAttribLocation(
            this._shaderSets.at(1).shaderProgram,
            'a_texCoord'
          )),
          (this._shaderSets.at(1).samplerTexture0Location = this.gl.getUniformLocation(
            this._shaderSets.at(1).shaderProgram,
            's_texture0'
          )),
          (this._shaderSets.at(1).uniformMatrixLocation = this.gl.getUniformLocation(
            this._shaderSets.at(1).shaderProgram,
            'u_matrix'
          )),
          (this._shaderSets.at(1).uniformBaseColorLocation = this.gl.getUniformLocation(
            this._shaderSets.at(1).shaderProgram,
            'u_baseColor'
          )),
          (this._shaderSets.at(1).uniformMultiplyColorLocation = this.gl.getUniformLocation(
            this._shaderSets.at(1).shaderProgram,
            'u_multiplyColor'
          )),
          (this._shaderSets.at(1).uniformScreenColorLocation = this.gl.getUniformLocation(
            this._shaderSets.at(1).shaderProgram,
            'u_screenColor'
          )),
          (this._shaderSets.at(2).attributePositionLocation = this.gl.getAttribLocation(
            this._shaderSets.at(2).shaderProgram,
            'a_position'
          )),
          (this._shaderSets.at(2).attributeTexCoordLocation = this.gl.getAttribLocation(
            this._shaderSets.at(2).shaderProgram,
            'a_texCoord'
          )),
          (this._shaderSets.at(2).samplerTexture0Location = this.gl.getUniformLocation(
            this._shaderSets.at(2).shaderProgram,
            's_texture0'
          )),
          (this._shaderSets.at(2).samplerTexture1Location = this.gl.getUniformLocation(
            this._shaderSets.at(2).shaderProgram,
            's_texture1'
          )),
          (this._shaderSets.at(2).uniformMatrixLocation = this.gl.getUniformLocation(
            this._shaderSets.at(2).shaderProgram,
            'u_matrix'
          )),
          (this._shaderSets.at(2).uniformClipMatrixLocation = this.gl.getUniformLocation(
            this._shaderSets.at(2).shaderProgram,
            'u_clipMatrix'
          )),
          (this._shaderSets.at(2).uniformChannelFlagLocation = this.gl.getUniformLocation(
            this._shaderSets.at(2).shaderProgram,
            'u_channelFlag'
          )),
          (this._shaderSets.at(2).uniformBaseColorLocation = this.gl.getUniformLocation(
            this._shaderSets.at(2).shaderProgram,
            'u_baseColor'
          )),
          (this._shaderSets.at(2).uniformMultiplyColorLocation = this.gl.getUniformLocation(
            this._shaderSets.at(2).shaderProgram,
            'u_multiplyColor'
          )),
          (this._shaderSets.at(2).uniformScreenColorLocation = this.gl.getUniformLocation(
            this._shaderSets.at(2).shaderProgram,
            'u_screenColor'
          )),
          (this._shaderSets.at(3).attributePositionLocation = this.gl.getAttribLocation(
            this._shaderSets.at(3).shaderProgram,
            'a_position'
          )),
          (this._shaderSets.at(3).attributeTexCoordLocation = this.gl.getAttribLocation(
            this._shaderSets.at(3).shaderProgram,
            'a_texCoord'
          )),
          (this._shaderSets.at(3).samplerTexture0Location = this.gl.getUniformLocation(
            this._shaderSets.at(3).shaderProgram,
            's_texture0'
          )),
          (this._shaderSets.at(3).samplerTexture1Location = this.gl.getUniformLocation(
            this._shaderSets.at(3).shaderProgram,
            's_texture1'
          )),
          (this._shaderSets.at(3).uniformMatrixLocation = this.gl.getUniformLocation(
            this._shaderSets.at(3).shaderProgram,
            'u_matrix'
          )),
          (this._shaderSets.at(3).uniformClipMatrixLocation = this.gl.getUniformLocation(
            this._shaderSets.at(3).shaderProgram,
            'u_clipMatrix'
          )),
          (this._shaderSets.at(3).uniformChannelFlagLocation = this.gl.getUniformLocation(
            this._shaderSets.at(3).shaderProgram,
            'u_channelFlag'
          )),
          (this._shaderSets.at(3).uniformBaseColorLocation = this.gl.getUniformLocation(
            this._shaderSets.at(3).shaderProgram,
            'u_baseColor'
          )),
          (this._shaderSets.at(3).uniformMultiplyColorLocation = this.gl.getUniformLocation(
            this._shaderSets.at(3).shaderProgram,
            'u_multiplyColor'
          )),
          (this._shaderSets.at(3).uniformScreenColorLocation = this.gl.getUniformLocation(
            this._shaderSets.at(3).shaderProgram,
            'u_screenColor'
          )),
          (this._shaderSets.at(4).attributePositionLocation = this.gl.getAttribLocation(
            this._shaderSets.at(4).shaderProgram,
            'a_position'
          )),
          (this._shaderSets.at(4).attributeTexCoordLocation = this.gl.getAttribLocation(
            this._shaderSets.at(4).shaderProgram,
            'a_texCoord'
          )),
          (this._shaderSets.at(4).samplerTexture0Location = this.gl.getUniformLocation(
            this._shaderSets.at(4).shaderProgram,
            's_texture0'
          )),
          (this._shaderSets.at(4).uniformMatrixLocation = this.gl.getUniformLocation(
            this._shaderSets.at(4).shaderProgram,
            'u_matrix'
          )),
          (this._shaderSets.at(4).uniformBaseColorLocation = this.gl.getUniformLocation(
            this._shaderSets.at(4).shaderProgram,
            'u_baseColor'
          )),
          (this._shaderSets.at(4).uniformMultiplyColorLocation = this.gl.getUniformLocation(
            this._shaderSets.at(4).shaderProgram,
            'u_multiplyColor'
          )),
          (this._shaderSets.at(4).uniformScreenColorLocation = this.gl.getUniformLocation(
            this._shaderSets.at(4).shaderProgram,
            'u_screenColor'
          )),
          (this._shaderSets.at(5).attributePositionLocation = this.gl.getAttribLocation(
            this._shaderSets.at(5).shaderProgram,
            'a_position'
          )),
          (this._shaderSets.at(5).attributeTexCoordLocation = this.gl.getAttribLocation(
            this._shaderSets.at(5).shaderProgram,
            'a_texCoord'
          )),
          (this._shaderSets.at(5).samplerTexture0Location = this.gl.getUniformLocation(
            this._shaderSets.at(5).shaderProgram,
            's_texture0'
          )),
          (this._shaderSets.at(5).samplerTexture1Location = this.gl.getUniformLocation(
            this._shaderSets.at(5).shaderProgram,
            's_texture1'
          )),
          (this._shaderSets.at(5).uniformMatrixLocation = this.gl.getUniformLocation(
            this._shaderSets.at(5).shaderProgram,
            'u_matrix'
          )),
          (this._shaderSets.at(5).uniformClipMatrixLocation = this.gl.getUniformLocation(
            this._shaderSets.at(5).shaderProgram,
            'u_clipMatrix'
          )),
          (this._shaderSets.at(5).uniformChannelFlagLocation = this.gl.getUniformLocation(
            this._shaderSets.at(5).shaderProgram,
            'u_channelFlag'
          )),
          (this._shaderSets.at(5).uniformBaseColorLocation = this.gl.getUniformLocation(
            this._shaderSets.at(5).shaderProgram,
            'u_baseColor'
          )),
          (this._shaderSets.at(5).uniformMultiplyColorLocation = this.gl.getUniformLocation(
            this._shaderSets.at(5).shaderProgram,
            'u_multiplyColor'
          )),
          (this._shaderSets.at(5).uniformScreenColorLocation = this.gl.getUniformLocation(
            this._shaderSets.at(5).shaderProgram,
            'u_screenColor'
          )),
          (this._shaderSets.at(6).attributePositionLocation = this.gl.getAttribLocation(
            this._shaderSets.at(6).shaderProgram,
            'a_position'
          )),
          (this._shaderSets.at(6).attributeTexCoordLocation = this.gl.getAttribLocation(
            this._shaderSets.at(6).shaderProgram,
            'a_texCoord'
          )),
          (this._shaderSets.at(6).samplerTexture0Location = this.gl.getUniformLocation(
            this._shaderSets.at(6).shaderProgram,
            's_texture0'
          )),
          (this._shaderSets.at(6).samplerTexture1Location = this.gl.getUniformLocation(
            this._shaderSets.at(6).shaderProgram,
            's_texture1'
          )),
          (this._shaderSets.at(6).uniformMatrixLocation = this.gl.getUniformLocation(
            this._shaderSets.at(6).shaderProgram,
            'u_matrix'
          )),
          (this._shaderSets.at(6).uniformClipMatrixLocation = this.gl.getUniformLocation(
            this._shaderSets.at(6).shaderProgram,
            'u_clipMatrix'
          )),
          (this._shaderSets.at(6).uniformChannelFlagLocation = this.gl.getUniformLocation(
            this._shaderSets.at(6).shaderProgram,
            'u_channelFlag'
          )),
          (this._shaderSets.at(6).uniformBaseColorLocation = this.gl.getUniformLocation(
            this._shaderSets.at(6).shaderProgram,
            'u_baseColor'
          )),
          (this._shaderSets.at(6).uniformMultiplyColorLocation = this.gl.getUniformLocation(
            this._shaderSets.at(6).shaderProgram,
            'u_multiplyColor'
          )),
          (this._shaderSets.at(6).uniformScreenColorLocation = this.gl.getUniformLocation(
            this._shaderSets.at(6).shaderProgram,
            'u_screenColor'
          )),
          (this._shaderSets.at(7).attributePositionLocation = this.gl.getAttribLocation(
            this._shaderSets.at(7).shaderProgram,
            'a_position'
          )),
          (this._shaderSets.at(7).attributeTexCoordLocation = this.gl.getAttribLocation(
            this._shaderSets.at(7).shaderProgram,
            'a_texCoord'
          )),
          (this._shaderSets.at(7).samplerTexture0Location = this.gl.getUniformLocation(
            this._shaderSets.at(7).shaderProgram,
            's_texture0'
          )),
          (this._shaderSets.at(7).uniformMatrixLocation = this.gl.getUniformLocation(
            this._shaderSets.at(7).shaderProgram,
            'u_matrix'
          )),
          (this._shaderSets.at(7).uniformBaseColorLocation = this.gl.getUniformLocation(
            this._shaderSets.at(7).shaderProgram,
            'u_baseColor'
          )),
          (this._shaderSets.at(7).uniformMultiplyColorLocation = this.gl.getUniformLocation(
            this._shaderSets.at(7).shaderProgram,
            'u_multiplyColor'
          )),
          (this._shaderSets.at(7).uniformScreenColorLocation = this.gl.getUniformLocation(
            this._shaderSets.at(7).shaderProgram,
            'u_screenColor'
          )),
          (this._shaderSets.at(8).attributePositionLocation = this.gl.getAttribLocation(
            this._shaderSets.at(8).shaderProgram,
            'a_position'
          )),
          (this._shaderSets.at(8).attributeTexCoordLocation = this.gl.getAttribLocation(
            this._shaderSets.at(8).shaderProgram,
            'a_texCoord'
          )),
          (this._shaderSets.at(8).samplerTexture0Location = this.gl.getUniformLocation(
            this._shaderSets.at(8).shaderProgram,
            's_texture0'
          )),
          (this._shaderSets.at(8).samplerTexture1Location = this.gl.getUniformLocation(
            this._shaderSets.at(8).shaderProgram,
            's_texture1'
          )),
          (this._shaderSets.at(8).uniformMatrixLocation = this.gl.getUniformLocation(
            this._shaderSets.at(8).shaderProgram,
            'u_matrix'
          )),
          (this._shaderSets.at(8).uniformClipMatrixLocation = this.gl.getUniformLocation(
            this._shaderSets.at(8).shaderProgram,
            'u_clipMatrix'
          )),
          (this._shaderSets.at(8).uniformChannelFlagLocation = this.gl.getUniformLocation(
            this._shaderSets.at(8).shaderProgram,
            'u_channelFlag'
          )),
          (this._shaderSets.at(8).uniformBaseColorLocation = this.gl.getUniformLocation(
            this._shaderSets.at(8).shaderProgram,
            'u_baseColor'
          )),
          (this._shaderSets.at(8).uniformMultiplyColorLocation = this.gl.getUniformLocation(
            this._shaderSets.at(8).shaderProgram,
            'u_multiplyColor'
          )),
          (this._shaderSets.at(8).uniformScreenColorLocation = this.gl.getUniformLocation(
            this._shaderSets.at(8).shaderProgram,
            'u_screenColor'
          )),
          (this._shaderSets.at(9).attributePositionLocation = this.gl.getAttribLocation(
            this._shaderSets.at(9).shaderProgram,
            'a_position'
          )),
          (this._shaderSets.at(9).attributeTexCoordLocation = this.gl.getAttribLocation(
            this._shaderSets.at(9).shaderProgram,
            'a_texCoord'
          )),
          (this._shaderSets.at(9).samplerTexture0Location = this.gl.getUniformLocation(
            this._shaderSets.at(9).shaderProgram,
            's_texture0'
          )),
          (this._shaderSets.at(9).samplerTexture1Location = this.gl.getUniformLocation(
            this._shaderSets.at(9).shaderProgram,
            's_texture1'
          )),
          (this._shaderSets.at(9).uniformMatrixLocation = this.gl.getUniformLocation(
            this._shaderSets.at(9).shaderProgram,
            'u_matrix'
          )),
          (this._shaderSets.at(9).uniformClipMatrixLocation = this.gl.getUniformLocation(
            this._shaderSets.at(9).shaderProgram,
            'u_clipMatrix'
          )),
          (this._shaderSets.at(9).uniformChannelFlagLocation = this.gl.getUniformLocation(
            this._shaderSets.at(9).shaderProgram,
            'u_channelFlag'
          )),
          (this._shaderSets.at(9).uniformBaseColorLocation = this.gl.getUniformLocation(
            this._shaderSets.at(9).shaderProgram,
            'u_baseColor'
          )),
          (this._shaderSets.at(9).uniformMultiplyColorLocation = this.gl.getUniformLocation(
            this._shaderSets.at(9).shaderProgram,
            'u_multiplyColor'
          )),
          (this._shaderSets.at(9).uniformScreenColorLocation = this.gl.getUniformLocation(
            this._shaderSets.at(9).shaderProgram,
            'u_screenColor'
          )))
      }
      loadShaderProgram(t, e) {
        let i = this.gl.createProgram(),
          s = this.compileShaderSource(this.gl.VERTEX_SHADER, t)
        if (!s) return (M('Vertex shader compile error!'), 0)
        let r = this.compileShaderSource(this.gl.FRAGMENT_SHADER, e)
        return r
          ? (this.gl.attachShader(i, s),
            this.gl.attachShader(i, r),
            this.gl.linkProgram(i),
            this.gl.getProgramParameter(i, this.gl.LINK_STATUS)
              ? (this.gl.deleteShader(s), this.gl.deleteShader(r), i)
              : (M('Failed to link program: {0}', i),
                this.gl.deleteShader(s),
                (s = 0),
                this.gl.deleteShader(r),
                (r = 0),
                i && (this.gl.deleteProgram(i), (i = 0)),
                0))
          : (M('Vertex shader compile error!'), 0)
      }
      compileShaderSource(t, e) {
        const i = e,
          s = this.gl.createShader(t)
        if ((this.gl.shaderSource(s, i), this.gl.compileShader(s), !s)) {
          const t = this.gl.getShaderInfoLog(s)
          M('Shader compile log: {0} ', t)
        }
        return this.gl.getShaderParameter(s, this.gl.COMPILE_STATUS)
          ? s
          : (this.gl.deleteShader(s), null)
      }
      setGl(t) {
        this.gl = t
      }
    }
    class Ki {}
    var Qi
    !(function (t) {
      ;((t[(t.ShaderNames_SetupMask = 0)] = 'ShaderNames_SetupMask'),
        (t[(t.ShaderNames_NormalPremultipliedAlpha = 1)] = 'ShaderNames_NormalPremultipliedAlpha'),
        (t[(t.ShaderNames_NormalMaskedPremultipliedAlpha = 2)] =
          'ShaderNames_NormalMaskedPremultipliedAlpha'),
        (t[(t.ShaderNames_NomralMaskedInvertedPremultipliedAlpha = 3)] =
          'ShaderNames_NomralMaskedInvertedPremultipliedAlpha'),
        (t[(t.ShaderNames_AddPremultipliedAlpha = 4)] = 'ShaderNames_AddPremultipliedAlpha'),
        (t[(t.ShaderNames_AddMaskedPremultipliedAlpha = 5)] =
          'ShaderNames_AddMaskedPremultipliedAlpha'),
        (t[(t.ShaderNames_AddMaskedPremultipliedAlphaInverted = 6)] =
          'ShaderNames_AddMaskedPremultipliedAlphaInverted'),
        (t[(t.ShaderNames_MultPremultipliedAlpha = 7)] = 'ShaderNames_MultPremultipliedAlpha'),
        (t[(t.ShaderNames_MultMaskedPremultipliedAlpha = 8)] =
          'ShaderNames_MultMaskedPremultipliedAlpha'),
        (t[(t.ShaderNames_MultMaskedPremultipliedAlphaInverted = 9)] =
          'ShaderNames_MultMaskedPremultipliedAlphaInverted'))
    })(Qi || (Qi = {}))
    const ts =
        'attribute vec4     a_position;attribute vec2     a_texCoord;varying vec2       v_texCoord;varying vec4       v_myPos;uniform mat4       u_clipMatrix;void main(){   gl_Position = u_clipMatrix * a_position;   v_myPos = u_clipMatrix * a_position;   v_texCoord = a_texCoord;   v_texCoord.y = 1.0 - v_texCoord.y;}',
      es =
        'precision mediump float;varying vec2       v_texCoord;varying vec4       v_myPos;uniform vec4       u_baseColor;uniform vec4       u_channelFlag;uniform sampler2D  s_texture0;void main(){   float isInside =        step(u_baseColor.x, v_myPos.x/v_myPos.w)       * step(u_baseColor.y, v_myPos.y/v_myPos.w)       * step(v_myPos.x/v_myPos.w, u_baseColor.z)       * step(v_myPos.y/v_myPos.w, u_baseColor.w);   gl_FragColor = u_channelFlag * texture2D(s_texture0, v_texCoord).a * isInside;}',
      is =
        'attribute vec4     a_position;attribute vec2     a_texCoord;varying vec2       v_texCoord;uniform mat4       u_matrix;void main(){   gl_Position = u_matrix * a_position;   v_texCoord = a_texCoord;   v_texCoord.y = 1.0 - v_texCoord.y;}',
      ss =
        'attribute vec4     a_position;attribute vec2     a_texCoord;varying vec2       v_texCoord;varying vec4       v_clipPos;uniform mat4       u_matrix;uniform mat4       u_clipMatrix;void main(){   gl_Position = u_matrix * a_position;   v_clipPos = u_clipMatrix * a_position;   v_texCoord = a_texCoord;   v_texCoord.y = 1.0 - v_texCoord.y;}',
      rs =
        'precision mediump float;varying vec2       v_texCoord;uniform vec4       u_baseColor;uniform sampler2D  s_texture0;uniform vec4       u_multiplyColor;uniform vec4       u_screenColor;void main(){   vec4 texColor = texture2D(s_texture0, v_texCoord);   texColor.rgb = texColor.rgb * u_multiplyColor.rgb;   texColor.rgb = (texColor.rgb + u_screenColor.rgb * texColor.a) - (texColor.rgb * u_screenColor.rgb);   vec4 color = texColor * u_baseColor;   gl_FragColor = vec4(color.rgb, color.a);}',
      as =
        'precision mediump float;varying vec2       v_texCoord;varying vec4       v_clipPos;uniform vec4       u_baseColor;uniform vec4       u_channelFlag;uniform sampler2D  s_texture0;uniform sampler2D  s_texture1;uniform vec4       u_multiplyColor;uniform vec4       u_screenColor;void main(){   vec4 texColor = texture2D(s_texture0, v_texCoord);   texColor.rgb = texColor.rgb * u_multiplyColor.rgb;   texColor.rgb = (texColor.rgb + u_screenColor.rgb * texColor.a) - (texColor.rgb * u_screenColor.rgb);   vec4 col_formask = texColor * u_baseColor;   vec4 clipMask = (1.0 - texture2D(s_texture1, v_clipPos.xy / v_clipPos.w)) * u_channelFlag;   float maskVal = clipMask.r + clipMask.g + clipMask.b + clipMask.a;   col_formask = col_formask * maskVal;   gl_FragColor = col_formask;}',
      ns =
        'precision mediump float;varying vec2      v_texCoord;varying vec4      v_clipPos;uniform sampler2D s_texture0;uniform sampler2D s_texture1;uniform vec4      u_channelFlag;uniform vec4      u_baseColor;uniform vec4      u_multiplyColor;uniform vec4      u_screenColor;void main(){   vec4 texColor = texture2D(s_texture0, v_texCoord);   texColor.rgb = texColor.rgb * u_multiplyColor.rgb;   texColor.rgb = (texColor.rgb + u_screenColor.rgb * texColor.a) - (texColor.rgb * u_screenColor.rgb);   vec4 col_formask = texColor * u_baseColor;   vec4 clipMask = (1.0 - texture2D(s_texture1, v_clipPos.xy / v_clipPos.w)) * u_channelFlag;   float maskVal = clipMask.r + clipMask.g + clipMask.b + clipMask.a;   col_formask = col_formask * (1.0 - maskVal);   gl_FragColor = col_formask;}'
    class os extends m {
      initialize(t, e = 1) {
        ;(t.isUsingMasking() &&
          ((this._clippingManager = new qi()),
          this._clippingManager.initialize(
            t,
            t.getDrawableCount(),
            t.getDrawableMasks(),
            t.getDrawableMaskCounts(),
            e
          )),
          this._sortedDrawableIndexList.resize(t.getDrawableCount(), 0),
          super.initialize(t))
      }
      bindTexture(t, e) {
        this._textures.setValue(t, e)
      }
      getBindedTextures() {
        return this._textures
      }
      setClippingMaskBufferSize(t) {
        if (!this._model.isUsingMasking()) return
        const e = this._clippingManager.getRenderTextureCount()
        ;(this._clippingManager.release(),
          (this._clippingManager = void 0),
          (this._clippingManager = null),
          (this._clippingManager = new qi()),
          this._clippingManager.setClippingMaskBufferSize(t),
          this._clippingManager.initialize(
            this.getModel(),
            this.getModel().getDrawableCount(),
            this.getModel().getDrawableMasks(),
            this.getModel().getDrawableMaskCounts(),
            e
          ))
      }
      getClippingMaskBufferSize() {
        return this._model.isUsingMasking() ? this._clippingManager.getClippingMaskBufferSize() : -1
      }
      getRenderTextureCount() {
        return this._model.isUsingMasking() ? this._clippingManager.getRenderTextureCount() : -1
      }
      constructor() {
        ;(super(),
          (this._clippingContextBufferForMask = null),
          (this._clippingContextBufferForDraw = null),
          (this._rendererProfile = new $i()),
          (this.firstDraw = !0),
          (this._textures = new I()),
          (this._sortedDrawableIndexList = new u()),
          (this._bufferData = {
            vertex: (WebGLBuffer = null),
            uv: (WebGLBuffer = null),
            index: (WebGLBuffer = null)
          }),
          this._textures.prepareCapacity(32, !0))
      }
      release() {
        ;(this._clippingManager &&
          (this._clippingManager.release(),
          (this._clippingManager = void 0),
          (this._clippingManager = null)),
          null != this.gl &&
            (this.gl.deleteBuffer(this._bufferData.vertex),
            (this._bufferData.vertex = null),
            this.gl.deleteBuffer(this._bufferData.uv),
            (this._bufferData.uv = null),
            this.gl.deleteBuffer(this._bufferData.index),
            (this._bufferData.index = null),
            (this._bufferData = null),
            (this._textures = null)))
      }
      doDrawModel() {
        if (null == this.gl)
          return void M(
            "'gl' is null. WebGLRenderingContext is required.\nPlease call 'CubimRenderer_WebGL.startUp' function."
          )
        ;(null != this._clippingManager &&
          (this.preDraw(), this._clippingManager.setupClippingContext(this.getModel(), this)),
          this.preDraw())
        const t = this.getModel().getDrawableCount(),
          e = this.getModel().getDrawableRenderOrders()
        for (let i = 0; i < t; ++i) {
          const t = e[i]
          this._sortedDrawableIndexList.set(t, i)
        }
        for (let e = 0; e < t; ++e) {
          const t = this._sortedDrawableIndexList.at(e)
          if (!this.getModel().getDrawableDynamicFlagIsVisible(t)) continue
          const i =
            null != this._clippingManager
              ? this._clippingManager.getClippingContextListForDraw().at(t)
              : null
          if (null != i && this.isUsingHighPrecisionMask()) {
            i._isUsing &&
              (this.gl.viewport(
                0,
                0,
                this._clippingManager.getClippingMaskBufferSize(),
                this._clippingManager.getClippingMaskBufferSize()
              ),
              this.preDraw(),
              this.gl.bindFramebuffer(
                this.gl.FRAMEBUFFER,
                i.getClippingManager().getMaskRenderTexture().at(i._bufferIndex)
              ),
              this.gl.clearColor(1, 1, 1, 1),
              this.gl.clear(this.gl.COLOR_BUFFER_BIT))
            {
              const t = i._clippingIdCount
              for (let e = 0; e < t; e++) {
                const t = i._clippingIdList[e]
                this._model.getDrawableDynamicFlagVertexPositionsDidChange(t) &&
                  (this.setIsCulling(0 != this._model.getDrawableCulling(t)),
                  this.setClippingContextBufferForMask(i),
                  this.drawMesh(
                    this.getModel().getDrawableTextureIndex(t),
                    this.getModel().getDrawableVertexIndexCount(t),
                    this.getModel().getDrawableVertexCount(t),
                    this.getModel().getDrawableVertexIndices(t),
                    this.getModel().getDrawableVertices(t),
                    this.getModel().getDrawableVertexUvs(t),
                    this.getModel().getMultiplyColor(t),
                    this.getModel().getScreenColor(t),
                    this.getModel().getDrawableOpacity(t),
                    a.CubismBlendMode_Normal,
                    !1
                  ))
              }
            }
            ;(this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, Hi),
              this.setClippingContextBufferForMask(null),
              this.gl.viewport(Yi[0], Yi[1], Yi[2], Yi[3]),
              this.preDraw())
          }
          ;(this.setClippingContextBufferForDraw(i),
            this.setIsCulling(this.getModel().getDrawableCulling(t)),
            this.drawMesh(
              this.getModel().getDrawableTextureIndex(t),
              this.getModel().getDrawableVertexIndexCount(t),
              this.getModel().getDrawableVertexCount(t),
              this.getModel().getDrawableVertexIndices(t),
              this.getModel().getDrawableVertices(t),
              this.getModel().getDrawableVertexUvs(t),
              this.getModel().getMultiplyColor(t),
              this.getModel().getScreenColor(t),
              this.getModel().getDrawableOpacity(t),
              this.getModel().getDrawableBlendMode(t),
              this.getModel().getDrawableInvertedMaskBit(t)
            ))
        }
      }
      drawMesh(t, e, i, s, r, a, n, o, l, u, h) {
        ;(this.isCulling() ? this.gl.enable(this.gl.CULL_FACE) : this.gl.disable(this.gl.CULL_FACE),
          this.gl.frontFace(this.gl.CCW))
        const g = this.getModelColor()
        let d
        ;(null == this.getClippingContextBufferForMask() &&
          ((g.A *= l), this.isPremultipliedAlpha() && ((g.R *= g.A), (g.G *= g.A), (g.B *= g.A))),
          (d = null != this._textures.getValue(t) ? this._textures.getValue(t) : null),
          Zi.getInstance().setupShaderProgram(
            this,
            d,
            i,
            r,
            s,
            a,
            this._bufferData,
            l,
            u,
            g,
            n,
            o,
            this.isPremultipliedAlpha(),
            this.getMvpMatrix(),
            h
          ),
          this.gl.drawElements(this.gl.TRIANGLES, e, this.gl.UNSIGNED_SHORT, 0),
          this.gl.useProgram(null),
          this.setClippingContextBufferForDraw(null),
          this.setClippingContextBufferForMask(null))
      }
      saveProfile() {
        this._rendererProfile.save()
      }
      restoreProfile() {
        this._rendererProfile.restore()
      }
      static doStaticRelease() {
        Zi.deleteInstance()
      }
      setRenderState(t, e) {
        ;((Hi = t), (Yi = e))
      }
      preDraw() {
        if (
          (this.firstDraw && (this.firstDraw = !1),
          this.gl.disable(this.gl.SCISSOR_TEST),
          this.gl.disable(this.gl.STENCIL_TEST),
          this.gl.disable(this.gl.DEPTH_TEST),
          this.gl.frontFace(this.gl.CW),
          this.gl.enable(this.gl.BLEND),
          this.gl.colorMask(!0, !0, !0, !0),
          this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null),
          this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, null),
          this.getAnisotropy() > 0 && this._extension)
        )
          for (let t = 0; t < this._textures.getSize(); ++t)
            (this.gl.bindTexture(this.gl.TEXTURE_2D, this._textures.getValue(t)),
              this.gl.texParameterf(
                this.gl.TEXTURE_2D,
                this._extension.TEXTURE_MAX_ANISOTROPY_EXT,
                this.getAnisotropy()
              ))
      }
      setClippingContextBufferForMask(t) {
        this._clippingContextBufferForMask = t
      }
      getClippingContextBufferForMask() {
        return this._clippingContextBufferForMask
      }
      setClippingContextBufferForDraw(t) {
        this._clippingContextBufferForDraw = t
      }
      getClippingContextBufferForDraw() {
        return this._clippingContextBufferForDraw
      }
      startUp(t) {
        ;((this.gl = t),
          this._clippingManager && this._clippingManager.setGL(t),
          Zi.getInstance().setGl(t),
          this._rendererProfile.setGl(t),
          (this._extension =
            this.gl.getExtension('EXT_texture_filter_anisotropic') ||
            this.gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic') ||
            this.gl.getExtension('MOZ_EXT_texture_filter_anisotropic')))
      }
    }
    var ls, us, hs
    ;((m.staticRelease = () => {
      os.doStaticRelease()
    }),
      (function (t) {
        ;((t.CubismClippingContext = Ji),
          (t.CubismClippingManager_WebGL = qi),
          (t.CubismRenderTextureResource = Wi),
          (t.CubismRenderer_WebGL = os),
          (t.CubismShaderSet = Ki),
          (t.CubismShader_WebGL = Zi),
          (t.ShaderNames = Qi))
      })(ls || (ls = {})))
    class gs {
      constructor(t = !1, e = new p()) {
        ;((this.isOverwritten = t), (this.Color = e))
      }
    }
    class ds {
      constructor(t = !1, e = new p()) {
        ;((this.isOverwritten = t), (this.Color = e))
      }
    }
    class cs {
      constructor(t = !1, e = !1) {
        ;((this.isOverwritten = t), (this.isCulling = e))
      }
    }
    class _s {
      update() {
        ;(this._model.update(), this._model.drawables.resetDynamicFlags())
      }
      getPixelsPerUnit() {
        return null == this._model ? 0 : this._model.canvasinfo.PixelsPerUnit
      }
      getCanvasWidth() {
        return null == this._model
          ? 0
          : this._model.canvasinfo.CanvasWidth / this._model.canvasinfo.PixelsPerUnit
      }
      getCanvasHeight() {
        return null == this._model
          ? 0
          : this._model.canvasinfo.CanvasHeight / this._model.canvasinfo.PixelsPerUnit
      }
      saveParameters() {
        const t = this._model.parameters.count,
          e = this._savedParameters.getSize()
        for (let i = 0; i < t; ++i)
          i < e
            ? this._savedParameters.set(i, this._parameterValues[i])
            : this._savedParameters.pushBack(this._parameterValues[i])
      }
      getMultiplyColor(t) {
        return this.getOverwriteFlagForModelMultiplyColors() ||
          this.getOverwriteFlagForDrawableMultiplyColors(t)
          ? this._userMultiplyColors.at(t).Color
          : this.getDrawableMultiplyColor(t)
      }
      getScreenColor(t) {
        return this.getOverwriteFlagForModelScreenColors() ||
          this.getOverwriteFlagForDrawableScreenColors(t)
          ? this._userScreenColors.at(t).Color
          : this.getDrawableScreenColor(t)
      }
      setMultiplyColorByTextureColor(t, e) {
        this.setMultiplyColorByRGBA(t, e.R, e.G, e.B, e.A)
      }
      setMultiplyColorByRGBA(t, e, i, s, r = 1) {
        ;((this._userMultiplyColors.at(t).Color.R = e),
          (this._userMultiplyColors.at(t).Color.G = i),
          (this._userMultiplyColors.at(t).Color.B = s),
          (this._userMultiplyColors.at(t).Color.A = r))
      }
      setScreenColorByTextureColor(t, e) {
        this.setScreenColorByRGBA(t, e.R, e.G, e.B, e.A)
      }
      setScreenColorByRGBA(t, e, i, s, r = 1) {
        ;((this._userScreenColors.at(t).Color.R = e),
          (this._userScreenColors.at(t).Color.G = i),
          (this._userScreenColors.at(t).Color.B = s),
          (this._userScreenColors.at(t).Color.A = r))
      }
      getPartMultiplyColor(t) {
        return this._userPartMultiplyColors.at(t).Color
      }
      getPartScreenColor(t) {
        return this._userPartScreenColors.at(t).Color
      }
      setPartColor(t, e, i, s, r, a, n) {
        if (
          ((a.at(t).Color.R = e),
          (a.at(t).Color.G = i),
          (a.at(t).Color.B = s),
          (a.at(t).Color.A = r),
          a.at(t).isOverwritten)
        )
          for (let a = 0; a < this._partChildDrawables.at(t).getSize(); ++a) {
            const o = this._partChildDrawables.at(t).at(a)
            ;((n.at(o).Color.R = e),
              (n.at(o).Color.G = i),
              (n.at(o).Color.B = s),
              (n.at(o).Color.A = r))
          }
      }
      setPartMultiplyColorByTextureColor(t, e) {
        this.setPartMultiplyColorByRGBA(t, e.R, e.G, e.B, e.A)
      }
      setPartMultiplyColorByRGBA(t, e, i, s, r) {
        this.setPartColor(t, e, i, s, r, this._userPartMultiplyColors, this._userMultiplyColors)
      }
      setPartScreenColorByTextureColor(t, e) {
        this.setPartScreenColorByRGBA(t, e.R, e.G, e.B, e.A)
      }
      setPartScreenColorByRGBA(t, e, i, s, r) {
        this.setPartColor(t, e, i, s, r, this._userPartScreenColors, this._userScreenColors)
      }
      getOverwriteFlagForModelMultiplyColors() {
        return this._isOverwrittenModelMultiplyColors
      }
      getOverwriteFlagForModelScreenColors() {
        return this._isOverwrittenModelScreenColors
      }
      setOverwriteFlagForModelMultiplyColors(t) {
        this._isOverwrittenModelMultiplyColors = t
      }
      setOverwriteFlagForModelScreenColors(t) {
        this._isOverwrittenModelScreenColors = t
      }
      getOverwriteFlagForDrawableMultiplyColors(t) {
        return this._userMultiplyColors.at(t).isOverwritten
      }
      getOverwriteFlagForDrawableScreenColors(t) {
        return this._userScreenColors.at(t).isOverwritten
      }
      setOverwriteFlagForDrawableMultiplyColors(t, e) {
        this._userMultiplyColors.at(t).isOverwritten = e
      }
      setOverwriteFlagForDrawableScreenColors(t, e) {
        this._userScreenColors.at(t).isOverwritten = e
      }
      getOverwriteColorForPartMultiplyColors(t) {
        return this._userPartMultiplyColors.at(t).isOverwritten
      }
      getOverwriteColorForPartScreenColors(t) {
        return this._userPartScreenColors.at(t).isOverwritten
      }
      setOverwriteColorForPartColors(t, e, i, s) {
        i.at(t).isOverwritten = e
        for (let r = 0; r < this._partChildDrawables.at(t).getSize(); ++r) {
          const a = this._partChildDrawables.at(t).at(r)
          ;((s.at(a).isOverwritten = e),
            e &&
              ((s.at(a).Color.R = i.at(t).Color.R),
              (s.at(a).Color.G = i.at(t).Color.G),
              (s.at(a).Color.B = i.at(t).Color.B),
              (s.at(a).Color.A = i.at(t).Color.A)))
        }
      }
      setOverwriteColorForPartMultiplyColors(t, e) {
        ;((this._userPartMultiplyColors.at(t).isOverwritten = e),
          this.setOverwriteColorForPartColors(
            t,
            e,
            this._userPartMultiplyColors,
            this._userMultiplyColors
          ))
      }
      setOverwriteColorForPartScreenColors(t, e) {
        ;((this._userPartScreenColors.at(t).isOverwritten = e),
          this.setOverwriteColorForPartColors(
            t,
            e,
            this._userPartScreenColors,
            this._userScreenColors
          ))
      }
      getDrawableCulling(t) {
        if (this.getOverwriteFlagForModelCullings() || this.getOverwriteFlagForDrawableCullings(t))
          return this._userCullings.at(t).isCulling
        const e = this._model.drawables.constantFlags
        return !Live2DCubismCore.Utils.hasIsDoubleSidedBit(e[t])
      }
      setDrawableCulling(t, e) {
        this._userCullings.at(t).isCulling = e
      }
      getOverwriteFlagForModelCullings() {
        return this._isOverwrittenCullings
      }
      setOverwriteFlagForModelCullings(t) {
        this._isOverwrittenCullings = t
      }
      getOverwriteFlagForDrawableCullings(t) {
        return this._userCullings.at(t).isOverwritten
      }
      setOverwriteFlagForDrawableCullings(t, e) {
        this._userCullings.at(t).isOverwritten = e
      }
      getModelOapcity() {
        return this._modelOpacity
      }
      setModelOapcity(t) {
        this._modelOpacity = t
      }
      getModel() {
        return this._model
      }
      getPartIndex(t) {
        let e
        const i = this._model.parts.count
        for (e = 0; e < i; ++e) if (t == this._partIds.at(e)) return e
        return this._notExistPartId.isExist(t)
          ? this._notExistPartId.getValue(t)
          : ((e = i + this._notExistPartId.getSize()),
            this._notExistPartId.setValue(t, e),
            this._notExistPartOpacities.appendKey(e),
            e)
      }
      getPartId(t) {
        const e = this._model.parts.ids[t]
        return J.getIdManager().getId(e)
      }
      getPartCount() {
        return this._model.parts.count
      }
      setPartOpacityByIndex(t, e) {
        this._notExistPartOpacities.isExist(t)
          ? this._notExistPartOpacities.setValue(t, e)
          : (y(0 <= t && t < this.getPartCount()), (this._partOpacities[t] = e))
      }
      setPartOpacityById(t, e) {
        const i = this.getPartIndex(t)
        i < 0 || this.setPartOpacityByIndex(i, e)
      }
      getPartOpacityByIndex(t) {
        return this._notExistPartOpacities.isExist(t)
          ? this._notExistPartOpacities.getValue(t)
          : (y(0 <= t && t < this.getPartCount()), this._partOpacities[t])
      }
      getPartOpacityById(t) {
        const e = this.getPartIndex(t)
        return e < 0 ? 0 : this.getPartOpacityByIndex(e)
      }
      getParameterIndex(t) {
        let e
        const i = this._model.parameters.count
        for (e = 0; e < i; ++e) if (t == this._parameterIds.at(e)) return e
        return this._notExistParameterId.isExist(t)
          ? this._notExistParameterId.getValue(t)
          : ((e = this._model.parameters.count + this._notExistParameterId.getSize()),
            this._notExistParameterId.setValue(t, e),
            this._notExistParameterValues.appendKey(e),
            e)
      }
      getParameterCount() {
        return this._model.parameters.count
      }
      getParameterType(t) {
        return this._model.parameters.types[t]
      }
      getParameterMaximumValue(t) {
        return this._model.parameters.maximumValues[t]
      }
      getParameterMinimumValue(t) {
        return this._model.parameters.minimumValues[t]
      }
      getParameterDefaultValue(t) {
        return this._model.parameters.defaultValues[t]
      }
      getParameterValueByIndex(t) {
        return this._notExistParameterValues.isExist(t)
          ? this._notExistParameterValues.getValue(t)
          : (y(0 <= t && t < this.getParameterCount()), this._parameterValues[t])
      }
      getParameterValueById(t) {
        const e = this.getParameterIndex(t)
        return this.getParameterValueByIndex(e)
      }
      setParameterValueByIndex(t, e, i = 1) {
        this._notExistParameterValues.isExist(t)
          ? this._notExistParameterValues.setValue(
              t,
              1 == i ? e : this._notExistParameterValues.getValue(t) * (1 - i) + e * i
            )
          : (y(0 <= t && t < this.getParameterCount()),
            this._model.parameters.maximumValues[t] < e &&
              (e = this._model.parameters.maximumValues[t]),
            this._model.parameters.minimumValues[t] > e &&
              (e = this._model.parameters.minimumValues[t]),
            (this._parameterValues[t] =
              1 == i ? e : (this._parameterValues[t] = this._parameterValues[t] * (1 - i) + e * i)))
      }
      setParameterValueById(t, e, i = 1) {
        const s = this.getParameterIndex(t)
        this.setParameterValueByIndex(s, e, i)
      }
      addParameterValueByIndex(t, e, i = 1) {
        this.setParameterValueByIndex(t, this.getParameterValueByIndex(t) + e * i)
      }
      addParameterValueById(t, e, i = 1) {
        const s = this.getParameterIndex(t)
        this.addParameterValueByIndex(s, e, i)
      }
      multiplyParameterValueById(t, e, i = 1) {
        const s = this.getParameterIndex(t)
        this.multiplyParameterValueByIndex(s, e, i)
      }
      multiplyParameterValueByIndex(t, e, i = 1) {
        this.setParameterValueByIndex(t, this.getParameterValueByIndex(t) * (1 + (e - 1) * i))
      }
      getDrawableIndex(t) {
        const e = this._model.drawables.count
        for (let i = 0; i < e; ++i) if (this._drawableIds.at(i) == t) return i
        return -1
      }
      getDrawableCount() {
        return this._model.drawables.count
      }
      getDrawableId(t) {
        const e = this._model.drawables.ids
        return J.getIdManager().getId(e[t])
      }
      getDrawableRenderOrders() {
        return this._model.drawables.renderOrders
      }
      getDrawableTextureIndices(t) {
        return this.getDrawableTextureIndex(t)
      }
      getDrawableTextureIndex(t) {
        return this._model.drawables.textureIndices[t]
      }
      getDrawableDynamicFlagVertexPositionsDidChange(t) {
        const e = this._model.drawables.dynamicFlags
        return Live2DCubismCore.Utils.hasVertexPositionsDidChangeBit(e[t])
      }
      getDrawableVertexIndexCount(t) {
        return this._model.drawables.indexCounts[t]
      }
      getDrawableVertexCount(t) {
        return this._model.drawables.vertexCounts[t]
      }
      getDrawableVertices(t) {
        return this.getDrawableVertexPositions(t)
      }
      getDrawableVertexIndices(t) {
        return this._model.drawables.indices[t]
      }
      getDrawableVertexPositions(t) {
        return this._model.drawables.vertexPositions[t]
      }
      getDrawableVertexUvs(t) {
        return this._model.drawables.vertexUvs[t]
      }
      getDrawableOpacity(t) {
        return this._model.drawables.opacities[t]
      }
      getDrawableMultiplyColor(t) {
        const e = this._model.drawables.multiplyColors,
          i = 4 * t,
          s = new p()
        return ((s.R = e[i]), (s.G = e[i + 1]), (s.B = e[i + 2]), (s.A = e[i + 3]), s)
      }
      getDrawableScreenColor(t) {
        const e = this._model.drawables.screenColors,
          i = 4 * t,
          s = new p()
        return ((s.R = e[i]), (s.G = e[i + 1]), (s.B = e[i + 2]), (s.A = e[i + 3]), s)
      }
      getDrawableParentPartIndex(t) {
        return this._model.drawables.parentPartIndices[t]
      }
      getDrawableBlendMode(t) {
        const e = this._model.drawables.constantFlags
        return Live2DCubismCore.Utils.hasBlendAdditiveBit(e[t])
          ? a.CubismBlendMode_Additive
          : Live2DCubismCore.Utils.hasBlendMultiplicativeBit(e[t])
            ? a.CubismBlendMode_Multiplicative
            : a.CubismBlendMode_Normal
      }
      getDrawableInvertedMaskBit(t) {
        const e = this._model.drawables.constantFlags
        return Live2DCubismCore.Utils.hasIsInvertedMaskBit(e[t])
      }
      getDrawableMasks() {
        return this._model.drawables.masks
      }
      getDrawableMaskCounts() {
        return this._model.drawables.maskCounts
      }
      isUsingMasking() {
        for (let t = 0; t < this._model.drawables.count; ++t)
          if (!(this._model.drawables.maskCounts[t] <= 0)) return !0
        return !1
      }
      getDrawableDynamicFlagIsVisible(t) {
        const e = this._model.drawables.dynamicFlags
        return Live2DCubismCore.Utils.hasIsVisibleBit(e[t])
      }
      getDrawableDynamicFlagVisibilityDidChange(t) {
        const e = this._model.drawables.dynamicFlags
        return Live2DCubismCore.Utils.hasVisibilityDidChangeBit(e[t])
      }
      getDrawableDynamicFlagOpacityDidChange(t) {
        const e = this._model.drawables.dynamicFlags
        return Live2DCubismCore.Utils.hasOpacityDidChangeBit(e[t])
      }
      getDrawableDynamicFlagRenderOrderDidChange(t) {
        const e = this._model.drawables.dynamicFlags
        return Live2DCubismCore.Utils.hasRenderOrderDidChangeBit(e[t])
      }
      getDrawableDynamicFlagBlendColorDidChange(t) {
        const e = this._model.drawables.dynamicFlags
        return Live2DCubismCore.Utils.hasBlendColorDidChangeBit(e[t])
      }
      loadParameters() {
        let t = this._model.parameters.count
        const e = this._savedParameters.getSize()
        t > e && (t = e)
        for (let e = 0; e < t; ++e) this._parameterValues[e] = this._savedParameters.at(e)
      }
      initialize() {
        ;(y(this._model),
          (this._parameterValues = this._model.parameters.values),
          (this._partOpacities = this._model.parts.opacities),
          (this._parameterMaximumValues = this._model.parameters.maximumValues),
          (this._parameterMinimumValues = this._model.parameters.minimumValues))
        {
          const t = this._model.parameters.ids,
            e = this._model.parameters.count
          this._parameterIds.prepareCapacity(e)
          for (let i = 0; i < e; ++i) this._parameterIds.pushBack(J.getIdManager().getId(t[i]))
        }
        const t = this._model.parts.count
        {
          const e = this._model.parts.ids
          this._partIds.prepareCapacity(t)
          for (let i = 0; i < t; ++i) this._partIds.pushBack(J.getIdManager().getId(e[i]))
          ;(this._userPartMultiplyColors.prepareCapacity(t),
            this._userPartScreenColors.prepareCapacity(t),
            this._partChildDrawables.prepareCapacity(t))
        }
        {
          const e = this._model.drawables.ids,
            i = this._model.drawables.count
          ;(this._userMultiplyColors.prepareCapacity(i),
            this._userScreenColors.prepareCapacity(i),
            this._userCullings.prepareCapacity(i))
          const s = new cs(!1, !1)
          for (let e = 0; e < t; ++e) {
            const t = new p(1, 1, 1, 1),
              s = new p(0, 0, 0, 1),
              r = new ds(!1, t),
              a = new ds(!1, s)
            ;(this._userPartMultiplyColors.pushBack(r),
              this._userPartScreenColors.pushBack(a),
              this._partChildDrawables.pushBack(new u()),
              this._partChildDrawables.at(e).prepareCapacity(i))
          }
          for (let t = 0; t < i; ++t) {
            const i = new p(1, 1, 1, 1),
              r = new p(0, 0, 0, 1),
              a = new gs(!1, i),
              n = new gs(!1, r)
            ;(this._drawableIds.pushBack(J.getIdManager().getId(e[t])),
              this._userMultiplyColors.pushBack(a),
              this._userScreenColors.pushBack(n),
              this._userCullings.pushBack(s))
            const o = this.getDrawableParentPartIndex(t)
            o >= 0 && this._partChildDrawables.at(o).pushBack(t)
          }
        }
      }
      constructor(t) {
        ;((this._model = t),
          (this._parameterValues = null),
          (this._parameterMaximumValues = null),
          (this._parameterMinimumValues = null),
          (this._partOpacities = null),
          (this._savedParameters = new u()),
          (this._parameterIds = new u()),
          (this._drawableIds = new u()),
          (this._partIds = new u()),
          (this._isOverwrittenModelMultiplyColors = !1),
          (this._isOverwrittenModelScreenColors = !1),
          (this._isOverwrittenCullings = !1),
          (this._modelOpacity = 1),
          (this._userMultiplyColors = new u()),
          (this._userScreenColors = new u()),
          (this._userCullings = new u()),
          (this._userPartMultiplyColors = new u()),
          (this._userPartScreenColors = new u()),
          (this._partChildDrawables = new u()),
          (this._notExistPartId = new I()),
          (this._notExistParameterId = new I()),
          (this._notExistParameterValues = new I()),
          (this._notExistPartOpacities = new I()))
      }
      release() {
        ;(this._model.release(), (this._model = null))
      }
    }
    !(function (t) {
      t.CubismModel = _s
    })(us || (us = {}))
    class ms {
      static create(t, e) {
        let i = null
        if (e && !this.hasMocConsistency(t)) return (M('Inconsistent MOC3.'), i)
        const s = Live2DCubismCore.Moc.fromArrayBuffer(t)
        return (
          s && ((i = new ms(s)), (i._mocVersion = Live2DCubismCore.Version.csmGetMocVersion(s, t))),
          i
        )
      }
      static delete(t) {
        ;(t._moc._release(), (t._moc = null), (t = null))
      }
      createModel() {
        let t = null
        const e = Live2DCubismCore.Model.fromMoc(this._moc)
        return (e && ((t = new _s(e)), t.initialize(), ++this._modelCount), t)
      }
      deleteModel(t) {
        null != t && (t.release(), (t = null), --this._modelCount)
      }
      constructor(t) {
        ;((this._moc = t), (this._modelCount = 0), (this._mocVersion = 0))
      }
      release() {
        ;(y(0 == this._modelCount), this._moc._release(), (this._moc = null))
      }
      getLatestMocVersion() {
        return Live2DCubismCore.Version.csmGetLatestMocVersion()
      }
      getMocVersion() {
        return this._mocVersion
      }
      static hasMocConsistency(t) {
        return 1 === Live2DCubismCore.Moc.prototype.hasMocConsistency(t)
      }
    }
    !(function (t) {
      t.CubismMoc = ms
    })(hs || (hs = {}))
    const ps = 'Meta',
      fs = 'UserData'
    class ys {
      constructor(t, e) {
        this._json = F.create(t, e)
      }
      release() {
        F.delete(this._json)
      }
      getUserDataCount() {
        return this._json.getRoot().getValueByString(ps).getValueByString('UserDataCount').toInt()
      }
      getTotalUserDataSize() {
        return this._json
          .getRoot()
          .getValueByString(ps)
          .getValueByString('TotalUserDataSize')
          .toInt()
      }
      getUserDataTargetType(t) {
        return this._json
          .getRoot()
          .getValueByString(fs)
          .getValueByIndex(t)
          .getValueByString('Target')
          .getRawString()
      }
      getUserDataId(t) {
        return J.getIdManager().getId(
          this._json
            .getRoot()
            .getValueByString(fs)
            .getValueByIndex(t)
            .getValueByString('Id')
            .getRawString()
        )
      }
      getUserDataValue(t) {
        return this._json
          .getRoot()
          .getValueByString(fs)
          .getValueByIndex(t)
          .getValueByString('Value')
          .getRawString()
      }
    }
    var Ss, xs, Cs
    !(function (t) {
      t.CubismModelUserDataJson = ys
    })(Ss || (Ss = {}))
    class Bs {}
    class Ms {
      static create(t, e) {
        const i = new Ms()
        return (i.parseUserData(t, e), i)
      }
      static delete(t) {
        null != t && (t.release(), (t = null))
      }
      getArtMeshUserDatas() {
        return this._artMeshUserDataNode
      }
      parseUserData(t, e) {
        let i = new ys(t, e)
        const s = J.getIdManager().getId('ArtMesh'),
          r = i.getUserDataCount()
        for (let t = 0; t < r; t++) {
          const e = new Bs()
          ;((e.targetId = i.getUserDataId(t)),
            (e.targetType = J.getIdManager().getId(i.getUserDataTargetType(t))),
            (e.value = new g(i.getUserDataValue(t))),
            this._userDataNodes.pushBack(e),
            e.targetType == s && this._artMeshUserDataNode.pushBack(e))
        }
        ;(i.release(), (i = void 0))
      }
      constructor() {
        ;((this._userDataNodes = new u()), (this._artMeshUserDataNode = new u()))
      }
      release() {
        for (let t = 0; t < this._userDataNodes.getSize(); ++t) this._userDataNodes.set(t, null)
        this._userDataNodes = null
      }
    }
    !(function (t) {
      ;((t.CubismModelUserData = Ms), (t.CubismModelUserDataNode = Bs))
    })(xs || (xs = {}))
    class bs {
      isInitialized() {
        return this._initialized
      }
      setInitialized(t) {
        this._initialized = t
      }
      isUpdating() {
        return this._updating
      }
      setUpdating(t) {
        this._updating = t
      }
      setDragging(t, e) {
        this._dragManager.set(t, e)
      }
      setAcceleration(t, e, i) {
        ;((this._accelerationX = t), (this._accelerationY = e), (this._accelerationZ = i))
      }
      getModelMatrix() {
        return this._modelMatrix
      }
      setOpacity(t) {
        this._opacity = t
      }
      getOpacity() {
        return this._opacity
      }
      loadModel(t, e = !1) {
        ;((this._moc = ms.create(t, e)),
          null != this._moc
            ? ((this._model = this._moc.createModel()),
              null != this._model
                ? (this._model.saveParameters(),
                  (this._modelMatrix = new se(
                    this._model.getCanvasWidth(),
                    this._model.getCanvasHeight()
                  )))
                : M('Failed to CreateModel().'))
            : M('Failed to CubismMoc.create().'))
      }
      loadExpression(t, e, i) {
        return he.create(t, e)
      }
      loadPose(t, e) {
        this._pose = Jt.create(t, e)
      }
      loadUserData(t, e) {
        this._modelUserData = Ms.create(t, e)
      }
      loadPhysics(t, e) {
        this._physics = Pi.create(t, e)
      }
      isHit(t, e, i) {
        const s = this._model.getDrawableIndex(t)
        if (s < 0) return !1
        const r = this._model.getDrawableVertexCount(s),
          a = this._model.getDrawableVertices(s)
        let n = a[0],
          o = a[0],
          l = a[1],
          u = a[1]
        for (let t = 1; t < r; ++t) {
          const e = a[q.vertexOffset + t * q.vertexStep],
            i = a[q.vertexOffset + t * q.vertexStep + 1]
          ;(e < n && (n = e), e > o && (o = e), i < l && (l = i), i > u && (u = i))
        }
        const h = this._modelMatrix.invertTransformX(e),
          g = this._modelMatrix.invertTransformY(i)
        return n <= h && h <= o && l <= g && g <= u
      }
      getModel() {
        return this._model
      }
      getRenderer() {
        return this._renderer
      }
      createRenderer(t = 1) {
        ;(this._renderer && this.deleteRenderer(),
          (this._renderer = new os()),
          this._renderer.initialize(this._model, t))
      }
      deleteRenderer() {
        null != this._renderer && (this._renderer.release(), (this._renderer = null))
      }
      motionEventFired(t) {
        C('{0}', t.s)
      }
      static cubismDefaultMotionEventCallback(t, e, i) {
        null != i && i.motionEventFired(e)
      }
      constructor() {
        ;((this.loadMotion = (t, e, i, s) => Ne.create(t, e, s)),
          (this._moc = null),
          (this._model = null),
          (this._motionManager = null),
          (this._expressionManager = null),
          (this._eyeBlink = null),
          (this._breath = null),
          (this._modelMatrix = null),
          (this._pose = null),
          (this._dragManager = null),
          (this._physics = null),
          (this._modelUserData = null),
          (this._initialized = !1),
          (this._updating = !1),
          (this._opacity = 1),
          (this._lipsync = !0),
          (this._lastLipSyncValue = 0),
          (this._dragX = 0),
          (this._dragY = 0),
          (this._accelerationX = 0),
          (this._accelerationY = 0),
          (this._accelerationZ = 0),
          (this._mocConsistency = !1),
          (this._debugMode = !1),
          (this._renderer = null),
          (this._motionManager = new $e()),
          this._motionManager.setEventCallback(bs.cubismDefaultMotionEventCallback, this),
          (this._expressionManager = new $e()),
          (this._dragManager = new ne()))
      }
      release() {
        ;(null != this._motionManager &&
          (this._motionManager.release(), (this._motionManager = null)),
          null != this._expressionManager &&
            (this._expressionManager.release(), (this._expressionManager = null)),
          null != this._moc &&
            (this._moc.deleteModel(this._model), this._moc.release(), (this._moc = null)),
          (this._modelMatrix = null),
          Jt.delete(this._pose),
          Ht.delete(this._eyeBlink),
          Gt.delete(this._breath),
          (this._dragManager = null),
          Pi.delete(this._physics),
          Ms.delete(this._modelUserData),
          this.deleteRenderer())
      }
    }
    !(function (t) {
      t.CubismUserModel = bs
    })(Cs || (Cs = {}))
    var Ps = function (t, e, i, s) {
      return new (i || (i = Promise))(function (r, a) {
        function n(t) {
          try {
            l(s.next(t))
          } catch (t) {
            a(t)
          }
        }
        function o(t) {
          try {
            l(s.throw(t))
          } catch (t) {
            a(t)
          }
        }
        function l(t) {
          var e
          t.done
            ? r(t.value)
            : ((e = t.value),
              e instanceof i
                ? e
                : new i(function (t) {
                    t(e)
                  })).then(n, o)
        }
        l((s = s.apply(t, e || [])).next())
      })
    }
    function vs(t) {
      return Ps(this, void 0, void 0, function* () {
        if (Q.LoadFromCache && Q.Live2dDB) {
          const i = yield ('url',
          (e = t),
          new Promise((t, i) => {
            const s = Q.Live2dDB.transaction('live2d', 'readonly')
              .objectStore('live2d')
              .index('url')
              .get(e)
            ;((s.onsuccess = e => {
              const i = e.currentTarget.result
              t(i || void 0)
            }),
              (s.onerror = e => {
                t(void 0)
              }))
          }))
          if (void 0 !== i) {
            const t = i.arraybuffer
            return {
              arrayBuffer: () =>
                Ps(this, void 0, void 0, function* () {
                  return t
                })
            }
          }
        }
        var e
        const i = yield fetch(t),
          s = yield i.arrayBuffer()
        return (
          Q.LoadFromCache &&
            Q.Live2dDB &&
            (function (t) {
              new Promise((e, i) => {
                const s = Q.Live2dDB.transaction('live2d', 'readwrite').objectStore('live2d').add(t)
                ;((s.onsuccess = () => e(!0)), (s.onerror = () => e(!1)))
              })
            })({ url: t, arraybuffer: s }),
          {
            arrayBuffer: () =>
              Ps(this, void 0, void 0, function* () {
                return s
              })
          }
        )
      })
    }
    class ws {
      static loadFileAsBytes(t, e) {
        vs(t)
          .then(t => t.arrayBuffer())
          .then(t => e(t, t.byteLength))
      }
      static getDeltaTime() {
        return this.s_deltaTime
      }
      static updateTime() {
        ;((this.s_currentFrame = Date.now()),
          (this.s_deltaTime = (this.s_currentFrame - this.s_lastFrame) / 1e3),
          (this.s_lastFrame = this.s_currentFrame))
      }
      static printMessage(t) {}
    }
    ;((ws.lastUpdate = Date.now()),
      (ws.s_currentFrame = 0),
      (ws.s_lastFrame = 0),
      (ws.s_deltaTime = 0))
    var Is = function (t, e, i, s) {
      return new (i || (i = Promise))(function (r, a) {
        function n(t) {
          try {
            l(s.next(t))
          } catch (t) {
            a(t)
          }
        }
        function o(t) {
          try {
            l(s.throw(t))
          } catch (t) {
            a(t)
          }
        }
        function l(t) {
          var e
          t.done
            ? r(t.value)
            : ((e = t.value),
              e instanceof i
                ? e
                : new i(function (t) {
                    t(e)
                  })).then(n, o)
        }
        l((s = s.apply(t, e || [])).next())
      })
    }
    let Ts = null
    class Vs {
      static getInstance() {
        return (null == Ts && (Ts = new Vs()), Ts)
      }
      static releaseInstance() {
        ;(null != Ts && (Ts = void 0), (Ts = null))
      }
      update(t) {
        let e, i
        if (null == this._pcmData || this._sampleOffset >= this._wavFileInfo._samplesPerChannel)
          return ((this._lastRms = 0), !1)
        ;((this._userTimeSeconds += t),
          (e = Math.floor(this._userTimeSeconds * this._wavFileInfo._samplingRate)),
          e > this._wavFileInfo._samplesPerChannel && (e = this._wavFileInfo._samplesPerChannel),
          (i = 0))
        for (let t = 0; t < this._wavFileInfo._numberOfChannels; t++)
          for (let s = this._sampleOffset; s < e; s++) {
            const e = this._pcmData[t][s]
            i += e * e
          }
        return (
          (i = Math.sqrt(i / (this._wavFileInfo._numberOfChannels * (e - this._sampleOffset)))),
          (this._lastRms = i),
          (this._sampleOffset = e),
          !0
        )
      }
      start(t) {
        ;((this._sampleOffset = 0),
          (this._userTimeSeconds = 0),
          (this._lastRms = 0),
          this.loadWavFile(t))
      }
      getRms() {
        return this._lastRms
      }
      loadWavFile(t) {
        let e = !1
        null != this._pcmData && this.releasePcmData()
        const i = () =>
          Is(this, void 0, void 0, function* () {
            return vs(t).then(t => t.arrayBuffer())
          })
        return (
          (() => {
            Is(this, void 0, void 0, function* () {
              if (
                ((this._byteReader._fileByte = yield i()),
                (this._byteReader._fileDataView = new DataView(this._byteReader._fileByte)),
                (this._byteReader._fileSize = this._byteReader._fileByte.byteLength),
                (this._byteReader._readOffset = 0),
                null == this._byteReader._fileByte || this._byteReader._fileSize < 4)
              )
                return !1
              this._wavFileInfo._fileName = t
              try {
                if (!this._byteReader.getCheckSignature('RIFF'))
                  throw ((e = !1), new Error('Cannot find Signeture "RIFF".'))
                if (
                  (this._byteReader.get32LittleEndian(),
                  !this._byteReader.getCheckSignature('WAVE'))
                )
                  throw ((e = !1), new Error('Cannot find Signeture "WAVE".'))
                if (!this._byteReader.getCheckSignature('fmt '))
                  throw ((e = !1), new Error('Cannot find Signeture "fmt".'))
                const t = this._byteReader.get32LittleEndian()
                if (1 != this._byteReader.get16LittleEndian())
                  throw ((e = !1), new Error('File is not linear PCM.'))
                for (
                  this._wavFileInfo._numberOfChannels = this._byteReader.get16LittleEndian(),
                    this._wavFileInfo._samplingRate = this._byteReader.get32LittleEndian(),
                    this._byteReader.get32LittleEndian(),
                    this._byteReader.get16LittleEndian(),
                    this._wavFileInfo._bitsPerSample = this._byteReader.get16LittleEndian(),
                    t > 16 && (this._byteReader._readOffset += t - 16);
                  !this._byteReader.getCheckSignature('data') &&
                  this._byteReader._readOffset < this._byteReader._fileSize;

                )
                  this._byteReader._readOffset += this._byteReader.get32LittleEndian() + 4
                if (this._byteReader._readOffset >= this._byteReader._fileSize)
                  throw ((e = !1), new Error('Cannot find "data" Chunk.'))
                {
                  const t = this._byteReader.get32LittleEndian()
                  this._wavFileInfo._samplesPerChannel =
                    (8 * t) /
                    (this._wavFileInfo._bitsPerSample * this._wavFileInfo._numberOfChannels)
                }
                this._pcmData = new Array(this._wavFileInfo._numberOfChannels)
                for (let t = 0; t < this._wavFileInfo._numberOfChannels; t++)
                  this._pcmData[t] = new Float32Array(this._wavFileInfo._samplesPerChannel)
                for (let t = 0; t < this._wavFileInfo._samplesPerChannel; t++)
                  for (let e = 0; e < this._wavFileInfo._numberOfChannels; e++)
                    this._pcmData[e][t] = this.getPcmSample()
                e = !0
              } catch (t) {
                console.log(t)
              }
            })
          })(),
          e
        )
      }
      getPcmSample() {
        let t
        switch (this._wavFileInfo._bitsPerSample) {
          case 8:
            ;((t = this._byteReader.get8() - 128), (t <<= 24))
            break
          case 16:
            t = this._byteReader.get16LittleEndian() << 16
            break
          case 24:
            t = this._byteReader.get24LittleEndian() << 8
            break
          default:
            t = 0
        }
        return t / 2147483647
      }
      releasePcmData() {
        for (let t = 0; t < this._wavFileInfo._numberOfChannels; t++) delete this._pcmData[t]
        ;(delete this._pcmData, (this._pcmData = null))
      }
      constructor() {
        ;((this._loadFiletoBytes = (t, e) => {
          ;((this._byteReader._fileByte = t),
            (this._byteReader._fileDataView = new DataView(this._byteReader._fileByte)),
            (this._byteReader._fileSize = e))
        }),
          (this._pcmData = null),
          (this._userTimeSeconds = 0),
          (this._lastRms = 0),
          (this._sampleOffset = 0),
          (this._wavFileInfo = new Rs()),
          (this._byteReader = new Es()))
      }
    }
    class Rs {
      constructor() {
        ;((this._fileName = ''),
          (this._numberOfChannels = 0),
          (this._bitsPerSample = 0),
          (this._samplingRate = 0),
          (this._samplesPerChannel = 0))
      }
    }
    class Es {
      constructor() {
        ;((this._fileByte = null),
          (this._fileDataView = null),
          (this._fileSize = 0),
          (this._readOffset = 0))
      }
      get8() {
        const t = this._fileDataView.getUint8(this._readOffset)
        return (this._readOffset++, t)
      }
      get16LittleEndian() {
        const t =
          (this._fileDataView.getUint8(this._readOffset + 1) << 8) |
          this._fileDataView.getUint8(this._readOffset)
        return ((this._readOffset += 2), t)
      }
      get24LittleEndian() {
        const t =
          (this._fileDataView.getUint8(this._readOffset + 2) << 16) |
          (this._fileDataView.getUint8(this._readOffset + 1) << 8) |
          this._fileDataView.getUint8(this._readOffset)
        return ((this._readOffset += 3), t)
      }
      get32LittleEndian() {
        const t =
          (this._fileDataView.getUint8(this._readOffset + 3) << 24) |
          (this._fileDataView.getUint8(this._readOffset + 2) << 16) |
          (this._fileDataView.getUint8(this._readOffset + 1) << 8) |
          this._fileDataView.getUint8(this._readOffset)
        return ((this._readOffset += 4), t)
      }
      getCheckSignature(t) {
        const e = new Uint8Array(4),
          i = new TextEncoder().encode(t)
        if (4 != t.length) return !1
        for (let t = 0; t < 4; t++) e[t] = this.get8()
        return e[0] == i[0] && e[1] == i[1] && e[2] == i[2] && e[3] == i[3]
      }
    }
    var Fs,
      Ls = function (t, e, i, s) {
        return new (i || (i = Promise))(function (r, a) {
          function n(t) {
            try {
              l(s.next(t))
            } catch (t) {
              a(t)
            }
          }
          function o(t) {
            try {
              l(s.throw(t))
            } catch (t) {
              a(t)
            }
          }
          function l(t) {
            var e
            t.done
              ? r(t.value)
              : ((e = t.value),
                e instanceof i
                  ? e
                  : new i(function (t) {
                      t(e)
                    })).then(n, o)
          }
          l((s = s.apply(t, e || [])).next())
        })
      }
    !(function (t) {
      ;((t[(t.LoadAssets = 0)] = 'LoadAssets'),
        (t[(t.LoadModel = 1)] = 'LoadModel'),
        (t[(t.WaitLoadModel = 2)] = 'WaitLoadModel'),
        (t[(t.LoadExpression = 3)] = 'LoadExpression'),
        (t[(t.WaitLoadExpression = 4)] = 'WaitLoadExpression'),
        (t[(t.LoadPhysics = 5)] = 'LoadPhysics'),
        (t[(t.WaitLoadPhysics = 6)] = 'WaitLoadPhysics'),
        (t[(t.LoadPose = 7)] = 'LoadPose'),
        (t[(t.WaitLoadPose = 8)] = 'WaitLoadPose'),
        (t[(t.SetupEyeBlink = 9)] = 'SetupEyeBlink'),
        (t[(t.SetupBreath = 10)] = 'SetupBreath'),
        (t[(t.LoadUserData = 11)] = 'LoadUserData'),
        (t[(t.WaitLoadUserData = 12)] = 'WaitLoadUserData'),
        (t[(t.SetupEyeBlinkIds = 13)] = 'SetupEyeBlinkIds'),
        (t[(t.SetupLipSyncIds = 14)] = 'SetupLipSyncIds'),
        (t[(t.SetupLayout = 15)] = 'SetupLayout'),
        (t[(t.LoadMotion = 16)] = 'LoadMotion'),
        (t[(t.WaitLoadMotion = 17)] = 'WaitLoadMotion'),
        (t[(t.CompleteInitialize = 18)] = 'CompleteInitialize'),
        (t[(t.CompleteSetupModel = 19)] = 'CompleteSetupModel'),
        (t[(t.LoadTexture = 20)] = 'LoadTexture'),
        (t[(t.WaitLoadTexture = 21)] = 'WaitLoadTexture'),
        (t[(t.CompleteSetup = 22)] = 'CompleteSetup'))
    })(Fs || (Fs = {}))
    class As extends bs {
      loadAssets(t, e) {
        return Ls(this, void 0, void 0, function* () {
          this._modelHomeDir = t
          const i = yield vs(e),
            s = yield i.arrayBuffer(),
            r = new Xt(s, s.byteLength)
          ;((this._state = Fs.LoadModel), this.setupModel(r))
        })
      }
      setupModel(t) {
        if (
          ((this._updating = !0),
          (this._initialized = !1),
          (this._modelSetting = t),
          '' != this._modelSetting.getModelFileName())
        ) {
          const t = this._modelSetting.getModelFileName()
          ;(vs(`${this._modelHomeDir}${t}`)
            .then(t => t.arrayBuffer())
            .then(t => {
              ;(this.loadModel(t, this._mocConsistency), (this._state = Fs.LoadExpression), e())
            }),
            (this._state = Fs.WaitLoadModel))
        } else ws.printMessage('Model data does not exist.')
        const e = () => {
            if (this._modelSetting.getExpressionCount() > 0) {
              const t = this._modelSetting.getExpressionCount()
              for (let e = 0; e < t; ++e) {
                const s = this._modelSetting.getExpressionName(e),
                  r = this._modelSetting.getExpressionFileName(e)
                vs(`${this._modelHomeDir}${r}`)
                  .then(t => t.arrayBuffer())
                  .then(e => {
                    const r = this.loadExpression(e, e.byteLength, s)
                    ;(null != this._expressions.getValue(s) &&
                      (oe.delete(this._expressions.getValue(s)),
                      this._expressions.setValue(s, null)),
                      this._expressions.setValue(s, r),
                      this._expressionCount++,
                      this._expressionCount >= t && ((this._state = Fs.LoadPhysics), i()))
                  })
              }
              this._state = Fs.WaitLoadExpression
            } else ((this._state = Fs.LoadPhysics), i())
          },
          i = () => {
            if ('' != this._modelSetting.getPhysicsFileName()) {
              const t = this._modelSetting.getPhysicsFileName()
              ;(vs(`${this._modelHomeDir}${t}`)
                .then(t => t.arrayBuffer())
                .then(t => {
                  ;(this.loadPhysics(t, t.byteLength), (this._state = Fs.LoadPose), s())
                }),
                (this._state = Fs.WaitLoadPhysics))
            } else ((this._state = Fs.LoadPose), s())
          },
          s = () => {
            if ('' != this._modelSetting.getPoseFileName()) {
              const t = this._modelSetting.getPoseFileName()
              ;(vs(`${this._modelHomeDir}${t}`)
                .then(t => t.arrayBuffer())
                .then(t => {
                  ;(this.loadPose(t, t.byteLength), (this._state = Fs.SetupEyeBlink), r())
                }),
                (this._state = Fs.WaitLoadPose))
            } else ((this._state = Fs.SetupEyeBlink), r())
          },
          r = () => {
            ;(this._modelSetting.getEyeBlinkParameterCount() > 0 &&
              ((this._eyeBlink = Ht.create(this._modelSetting)), (this._state = Fs.SetupBreath)),
              a())
          },
          a = () => {
            this._breath = Gt.create()
            const t = new u()
            ;(t.pushBack(new Yt(this._idParamAngleX, 0, 15, 6.5345, 0.5)),
              t.pushBack(new Yt(this._idParamAngleY, 0, 8, 3.5345, 0.5)),
              t.pushBack(new Yt(this._idParamAngleZ, 0, 10, 5.5345, 0.5)),
              t.pushBack(new Yt(this._idParamBodyAngleX, 0, 4, 15.5345, 0.5)),
              t.pushBack(new Yt(J.getIdManager().getId(bt.ParamBreath), 0.5, 0.5, 3.2345, 1)),
              this._breath.setParameters(t),
              (this._state = Fs.LoadUserData),
              n())
          },
          n = () => {
            if ('' != this._modelSetting.getUserDataFile()) {
              const t = this._modelSetting.getUserDataFile()
              ;(vs(`${this._modelHomeDir}${t}`)
                .then(t => t.arrayBuffer())
                .then(t => {
                  ;(this.loadUserData(t, t.byteLength), (this._state = Fs.SetupEyeBlinkIds), o())
                }),
                (this._state = Fs.WaitLoadUserData))
            } else ((this._state = Fs.SetupEyeBlinkIds), o())
          },
          o = () => {
            const t = this._modelSetting.getEyeBlinkParameterCount()
            for (let e = 0; e < t; ++e)
              this._eyeBlinkIds.pushBack(this._modelSetting.getEyeBlinkParameterId(e))
            ;((this._state = Fs.SetupLipSyncIds), l())
          },
          l = () => {
            const t = this._modelSetting.getLipSyncParameterCount()
            for (let e = 0; e < t; ++e)
              this._lipSyncIds.pushBack(this._modelSetting.getLipSyncParameterId(e))
            ;((this._state = Fs.SetupLayout), h())
          },
          h = () => {
            const t = new I()
            null != this._modelSetting && null != this._modelMatrix
              ? (this._modelSetting.getLayoutMap(t),
                this._modelMatrix.setupFromLayout(t),
                (this._state = Fs.LoadMotion),
                g())
              : M('Failed to setupLayout().')
          },
          g = () => {
            ;((this._state = Fs.WaitLoadMotion),
              this._model.saveParameters(),
              (this._allMotionCount = 0),
              (this._motionCount = 0))
            const t = [],
              e = this._modelSetting.getMotionGroupCount()
            for (let i = 0; i < e; i++)
              ((t[i] = this._modelSetting.getMotionGroupName(i)),
                (this._allMotionCount += this._modelSetting.getMotionCount(t[i])))
            for (let i = 0; i < e; i++) this.preLoadMotionGroup(t[i])
            0 == e &&
              ((this._state = Fs.LoadTexture),
              this._motionManager.stopAllMotions(),
              (this._updating = !1),
              (this._initialized = !0),
              this.createRenderer(),
              this.setupTextures(),
              this.getRenderer().startUp(Js))
          }
      }
      setupTextures() {
        if (this._state == Fs.LoadTexture) {
          const t = this._modelSetting.getTextureCount()
          for (let e = 0; e < t; e++) {
            if ('' == this._modelSetting.getTextureFileName(e)) {
              console.log('getTextureFileName null')
              continue
            }
            let i = this._modelSetting.getTextureFileName(e)
            i = this._modelHomeDir + i
            const s = i => {
              ;(this.getRenderer().bindTexture(e, i.id),
                this._textureCount++,
                this._textureCount >= t && (this._state = Fs.CompleteSetup))
            }
            ;(Zs.getInstance().getTextureManager().createTextureFromFile(i, !0, s),
              this.getRenderer().setIsPremultipliedAlpha(!0))
          }
          this._state = Fs.WaitLoadTexture
        }
      }
      reloadRenderer() {
        ;(this.deleteRenderer(), this.createRenderer(), this.setupTextures())
      }
      update() {
        if (this._state != Fs.CompleteSetup) return
        const t = ws.getDeltaTime()
        ;((this._userTimeSeconds += t),
          this._dragManager.update(t),
          (this._dragX = this._dragManager.getX()),
          (this._dragY = this._dragManager.getY()))
        let e = !1
        if (
          (this._model.loadParameters(),
          this._motionManager.isFinished()
            ? this.startRandomMotion(Q.MotionGroupIdle, Q.PriorityIdle)
            : (e = this._motionManager.updateMotion(this._model, t)),
          this._model.saveParameters(),
          e || (null != this._eyeBlink && this._eyeBlink.updateParameters(this._model, t)),
          null != this._expressionManager && this._expressionManager.updateMotion(this._model, t),
          this._model.addParameterValueById(this._idParamAngleX, 30 * this._dragX),
          this._model.addParameterValueById(this._idParamAngleY, 30 * this._dragY),
          this._model.addParameterValueById(this._idParamAngleZ, this._dragX * this._dragY * -30),
          this._model.addParameterValueById(this._idParamBodyAngleX, 10 * this._dragX),
          this._model.addParameterValueById(this._idParamEyeBallX, this._dragX),
          this._model.addParameterValueById(this._idParamEyeBallY, this._dragY),
          null != this._breath && this._breath.updateParameters(this._model, t),
          null != this._physics && this._physics.evaluate(this._model, t),
          this._lipsync)
        ) {
          let e = 0
          ;(this._wavFileHandler.update(t), (e = this._wavFileHandler.getRms()))
          for (let t = 0; t < this._lipSyncIds.getSize(); ++t)
            this._model.addParameterValueById(this._lipSyncIds.at(t), e, 0.8)
        }
        ;(null != this._pose && this._pose.updateParameters(this._model, t), this._model.update())
      }
      startMotion(t, e, i, s) {
        if (i == Q.PriorityForce) this._motionManager.setReservePriority(i)
        else if (!this._motionManager.reserveMotion(i))
          return (this._debugMode && ws.printMessage("[APP]can't start motion."), Ge)
        const r = this._modelSetting.getMotionFileName(t, e),
          a = `${t}_${e}`
        let n = this._motions.getValue(a),
          o = !1
        null == n
          ? vs(`${this._modelHomeDir}${r}`)
              .then(t => t.arrayBuffer())
              .then(i => {
                n = this.loadMotion(i, i.byteLength, null, s)
                let r = this._modelSetting.getMotionFadeInTimeValue(t, e)
                ;(r >= 0 && n.setFadeInTime(r),
                  (r = this._modelSetting.getMotionFadeOutTimeValue(t, e)),
                  r >= 0 && n.setFadeOutTime(r),
                  n.setEffectIds(this._eyeBlinkIds, this._lipSyncIds),
                  (o = !0))
              })
          : n.setFinishedMotionHandler(s)
        const l = this._modelSetting.getMotionSoundFileName(t, e)
        if (0 != l.localeCompare('')) {
          let t = l
          ;((t = this._modelHomeDir + t), this._wavFileHandler.start(t))
        }
        return (
          this._debugMode && ws.printMessage(`[APP]start motion: [${t}_${e}`),
          this._motionManager.startMotionPriority(n, o, i)
        )
      }
      startRandomMotion(t, e, i) {
        if (0 == this._modelSetting.getMotionCount(t)) return Ge
        const s = Math.floor(Math.random() * this._modelSetting.getMotionCount(t))
        return this.startMotion(t, s, e, i)
      }
      setExpression(t) {
        const e = this._expressions.getValue(t)
        ;(this._debugMode && ws.printMessage(`[APP]expression: [${t}]`),
          null != e
            ? this._expressionManager.startMotionPriority(e, !0, Q.PriorityForce)
            : this._debugMode && ws.printMessage(`[APP]expression[${t}] is null`))
      }
      setRandomExpression() {
        if (0 == this._expressions.getSize()) return
        const t = Math.floor(Math.random() * this._expressions.getSize()),
          e = this._expressions._keyValues[t].first
        ;(ws.printMessage('set expression: ' + e), this.setExpression(e))
      }
      motionEventFired(t) {
        C('{0} is fired on LAppModel!!', t.s)
      }
      hitTest(t, e, i) {
        if (this._opacity < 1) return !1
        const s = this._modelSetting.getHitAreasCount()
        for (let r = 0; r < s; r++)
          if (this._modelSetting.getHitAreaName(r) == t) {
            const t = this._modelSetting.getHitAreaId(r)
            return this.isHit(t, e, i)
          }
        return !1
      }
      preLoadMotionGroup(t) {
        for (let e = 0; e < this._modelSetting.getMotionCount(t); e++) {
          const i = this._modelSetting.getMotionFileName(t, e),
            s = `${t}_${e}`
          ;(this._debugMode && ws.printMessage(`[APP]load motion: ${i} => [${s}]`),
            vs(`${this._modelHomeDir}${i}`)
              .then(t => t.arrayBuffer())
              .then(i => {
                const r = this.loadMotion(i, i.byteLength, s)
                let a = this._modelSetting.getMotionFadeInTimeValue(t, e)
                ;(a >= 0 && r.setFadeInTime(a),
                  (a = this._modelSetting.getMotionFadeOutTimeValue(t, e)),
                  a >= 0 && r.setFadeOutTime(a),
                  r.setEffectIds(this._eyeBlinkIds, this._lipSyncIds),
                  null != this._motions.getValue(s) && oe.delete(this._motions.getValue(s)),
                  this._motions.setValue(s, r),
                  this._motionCount++,
                  this._motionCount >= this._allMotionCount &&
                    ((this._state = Fs.LoadTexture),
                    this._motionManager.stopAllMotions(),
                    (this._updating = !1),
                    (this._initialized = !0),
                    this.createRenderer(),
                    this.setupTextures(),
                    this.getRenderer().startUp(Js)))
              }))
        }
      }
      releaseMotions() {
        this._motions.clear()
      }
      releaseExpressions() {
        this._expressions.clear()
      }
      doDraw() {
        if (null == this._model) return
        const t = [0, 0, qs.width, qs.height]
        ;(this.getRenderer().setRenderState($s, t), this.getRenderer().drawModel())
      }
      draw(t) {
        null != this._model &&
          this._state == Fs.CompleteSetup &&
          (t.multiplyByMatrix(this._modelMatrix), this.getRenderer().setMvpMatrix(t), this.doDraw())
      }
      hasMocConsistencyFromFile() {
        return Ls(this, void 0, void 0, function* () {
          if (
            (y(this._modelSetting.getModelFileName().localeCompare('')),
            '' != this._modelSetting.getModelFileName())
          ) {
            const t = this._modelSetting.getModelFileName(),
              e = yield vs(`${this._modelHomeDir}${t}`),
              i = yield e.arrayBuffer()
            return (
              (this._consistency = ms.hasMocConsistency(i)),
              this._consistency ? C('Consistent MOC3.') : C('Inconsistent MOC3.'),
              this._consistency
            )
          }
          ws.printMessage('Model data does not exist.')
        })
      }
      constructor() {
        ;(super(),
          (this._modelSetting = null),
          (this._modelHomeDir = null),
          (this._userTimeSeconds = 0),
          (this._eyeBlinkIds = new u()),
          (this._lipSyncIds = new u()),
          (this._motions = new I()),
          (this._expressions = new I()),
          (this._hitArea = new u()),
          (this._userArea = new u()),
          (this._idParamAngleX = J.getIdManager().getId(bt.ParamAngleX)),
          (this._idParamAngleY = J.getIdManager().getId(bt.ParamAngleY)),
          (this._idParamAngleZ = J.getIdManager().getId(bt.ParamAngleZ)),
          (this._idParamEyeBallX = J.getIdManager().getId(bt.ParamEyeBallX)),
          (this._idParamEyeBallY = J.getIdManager().getId(bt.ParamEyeBallY)),
          (this._idParamBodyAngleX = J.getIdManager().getId(bt.ParamBodyAngleX)),
          Q.MOCConsistencyValidationEnable && (this._mocConsistency = !0),
          (this._state = Fs.LoadAssets),
          (this._expressionCount = 0),
          (this._textureCount = 0),
          (this._motionCount = 0),
          (this._allMotionCount = 0),
          (this._wavFileHandler = new Vs()),
          (this._consistency = !1))
      }
    }
    let Ds = null
    class ks {
      static getInstance() {
        return (null == Ds && (Ds = new ks()), Ds)
      }
      static releaseInstance() {
        ;(null != Ds && (Ds = void 0), (Ds = null))
      }
      getModel(t) {
        return t < this._models.getSize() ? this._models.at(t) : null
      }
      get model() {
        return this.getModel(0)
      }
      releaseAllModel() {
        for (let t = 0; t < this._models.getSize(); t++)
          (this._models.at(t).release(), this._models.set(t, null))
        this._models.clear()
      }
      onDrag(t, e) {
        for (let i = 0; i < this._models.getSize(); i++) {
          const s = this.getModel(i)
          s && s.setDragging(t, e)
        }
      }
      onTap(t, e) {
        Q.DebugLogEnable &&
          ws.printMessage(`[APP]tap point: {x: ${t.toFixed(2)} y: ${e.toFixed(2)}}`)
        for (let i = 0; i < this._models.getSize(); i++)
          this._models.at(i).hitTest(Q.HitAreaNameHead, t, e)
            ? (Q.DebugLogEnable && ws.printMessage(`[APP]hit area: [${Q.HitAreaNameHead}]`),
              this._models.at(i).setRandomExpression())
            : this._models.at(i).hitTest(Q.HitAreaNameBody, t, e) &&
              (Q.DebugLogEnable && ws.printMessage(`[APP]hit area: [${Q.HitAreaNameBody}]`),
              this._models
                .at(i)
                .startRandomMotion(Q.MotionGroupTapBody, Q.PriorityNormal, this._finishedMotion))
      }
      onUpdate() {
        const { width: t, height: e } = qs,
          i = this._models.getSize()
        for (let s = 0; s < i; ++s) {
          const i = new _(),
            r = this.getModel(s)
          ;(r.getModel() &&
            (r.getModel().getCanvasWidth() > 1 && t < e
              ? (r.getModelMatrix().setWidth(2), i.scale(1, t / e))
              : i.scale(e / t, 1),
            null != this._viewMatrix && i.multiplyByMatrix(this._viewMatrix)),
            r.update(),
            r.draw(i))
        }
      }
      nextScene() {}
      getModelPath(t) {
        if (!t.includes('/')) return '.'
        const e = t.split('/')
        return (e.pop(), e.join('/') + '/')
      }
      loadLive2dModel() {
        const t = Q.ResourcesPath
        if (!t.endsWith('.model3.json'))
          return void console.log('无法加载模型！模型资源路径的结尾必须是.model3.json！')
        const e = this.getModelPath(t)
        ;(this.releaseAllModel(),
          this._models.pushBack(new As()),
          this._models.at(0).loadAssets(e, t))
      }
      setViewMatrix(t) {
        for (let e = 0; e < 16; e++) this._viewMatrix.getArray()[e] = t.getArray()[e]
      }
      constructor() {
        ;((this._finishedMotion = t => {
          ;(ws.printMessage('Motion Finished:'), console.log(t))
        }),
          (this._viewMatrix = new _()),
          (this._models = new u()),
          this.loadLive2dModel())
      }
    }
    var Os
    class Ns {
      constructor() {
        this._textures = new u()
      }
      release() {
        for (let t = this._textures.begin(); t.notEqual(this._textures.end()); t.preIncrement())
          Js.deleteTexture(t.ptr().id)
        this._textures = null
      }
      createTextureFromFile(t, e, i) {
        return (
          (s = this),
          (r = void 0),
          (n = function* () {
            for (let s = this._textures.begin(); s.notEqual(this._textures.end()); s.preIncrement())
              if (s.ptr().fileName == t && s.ptr().usePremultply == e)
                return (
                  (s.ptr().img = new Image()),
                  (s.ptr().img.onload = () => i(s.ptr())),
                  void (s.ptr().img.src = t)
                )
            const s = new Image()
            s.onload = () => {
              const r = Js.createTexture()
              ;(Js.bindTexture(Js.TEXTURE_2D, r),
                Js.texParameteri(Js.TEXTURE_2D, Js.TEXTURE_MIN_FILTER, Js.LINEAR_MIPMAP_LINEAR),
                Js.texParameteri(Js.TEXTURE_2D, Js.TEXTURE_MAG_FILTER, Js.LINEAR),
                e && Js.pixelStorei(Js.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1),
                Js.texImage2D(Js.TEXTURE_2D, 0, Js.RGBA, Js.RGBA, Js.UNSIGNED_BYTE, s),
                Js.generateMipmap(Js.TEXTURE_2D),
                Js.bindTexture(Js.TEXTURE_2D, null))
              const a = new Us()
              ;(null != a &&
                ((a.fileName = t),
                (a.width = s.width),
                (a.height = s.height),
                (a.id = r),
                (a.img = s),
                (a.usePremultply = e),
                this._textures.pushBack(a)),
                i(a))
            }
            const r = t.split('.').at(-1).toLowerCase(),
              a = yield vs(t),
              n = yield a.arrayBuffer(),
              o = new Blob([n], { type: 'image/' + r }),
              l = URL.createObjectURL(o)
            s.src = l
          }),
          new ((a = void 0) || (a = Promise))(function (t, e) {
            function i(t) {
              try {
                l(n.next(t))
              } catch (t) {
                e(t)
              }
            }
            function o(t) {
              try {
                l(n.throw(t))
              } catch (t) {
                e(t)
              }
            }
            function l(e) {
              var s
              e.done
                ? t(e.value)
                : ((s = e.value),
                  s instanceof a
                    ? s
                    : new a(function (t) {
                        t(s)
                      })).then(i, o)
            }
            l((n = n.apply(s, r || [])).next())
          })
        )
        var s, r, a, n
      }
      releaseTextures() {
        for (let t = 0; t < this._textures.getSize(); t++) this._textures.set(t, null)
        this._textures.clear()
      }
      releaseTextureByTexture(t) {
        for (let e = 0; e < this._textures.getSize(); e++)
          if (this._textures.at(e).id == t) {
            ;(this._textures.set(e, null), this._textures.remove(e))
            break
          }
      }
      releaseTextureByFilePath(t) {
        for (let e = 0; e < this._textures.getSize(); e++)
          if (this._textures.at(e).fileName == t) {
            ;(this._textures.set(e, null), this._textures.remove(e))
            break
          }
      }
    }
    class Us {
      constructor() {
        ;((this.id = null), (this.width = 0), (this.height = 0))
      }
    }
    class zs extends _ {
      constructor() {
        ;(super(),
          (this._screenLeft = 0),
          (this._screenRight = 0),
          (this._screenTop = 0),
          (this._screenBottom = 0),
          (this._maxLeft = 0),
          (this._maxRight = 0),
          (this._maxTop = 0),
          (this._maxBottom = 0),
          (this._maxScale = 0),
          (this._minScale = 0))
      }
      adjustTranslate(t, e) {
        ;(this._tr[0] * this._maxLeft + (this._tr[12] + t) > this._screenLeft &&
          (t = this._screenLeft - this._tr[0] * this._maxLeft - this._tr[12]),
          this._tr[0] * this._maxRight + (this._tr[12] + t) < this._screenRight &&
            (t = this._screenRight - this._tr[0] * this._maxRight - this._tr[12]),
          this._tr[5] * this._maxTop + (this._tr[13] + e) < this._screenTop &&
            (e = this._screenTop - this._tr[5] * this._maxTop - this._tr[13]),
          this._tr[5] * this._maxBottom + (this._tr[13] + e) > this._screenBottom &&
            (e = this._screenBottom - this._tr[5] * this._maxBottom - this._tr[13]))
        const i = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, t, e, 0, 1])
        _.multiply(i, this._tr, this._tr)
      }
      adjustScale(t, e, i) {
        const s = this.getMaxScale(),
          r = this.getMinScale(),
          a = i * this._tr[0]
        a < r
          ? this._tr[0] > 0 && (i = r / this._tr[0])
          : a > s && this._tr[0] > 0 && (i = s / this._tr[0])
        const n = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, t, e, 0, 1]),
          o = new Float32Array([i, 0, 0, 0, 0, i, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
          l = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -t, -e, 0, 1])
        ;(_.multiply(l, this._tr, this._tr),
          _.multiply(o, this._tr, this._tr),
          _.multiply(n, this._tr, this._tr))
      }
      setScreenRect(t, e, i, s) {
        ;((this._screenLeft = t),
          (this._screenRight = e),
          (this._screenBottom = i),
          (this._screenTop = s))
      }
      setMaxScreenRect(t, e, i, s) {
        ;((this._maxLeft = t), (this._maxRight = e), (this._maxTop = s), (this._maxBottom = i))
      }
      setMaxScale(t) {
        this._maxScale = t
      }
      setMinScale(t) {
        this._minScale = t
      }
      getMaxScale() {
        return this._maxScale
      }
      getMinScale() {
        return this._minScale
      }
      isMaxScale() {
        return this.getScaleX() >= this._maxScale
      }
      isMinScale() {
        return this.getScaleX() <= this._minScale
      }
      getScreenLeft() {
        return this._screenLeft
      }
      getScreenRight() {
        return this._screenRight
      }
      getScreenBottom() {
        return this._screenBottom
      }
      getScreenTop() {
        return this._screenTop
      }
      getMaxLeft() {
        return this._maxLeft
      }
      getMaxRight() {
        return this._maxRight
      }
      getMaxBottom() {
        return this._maxBottom
      }
      getMaxTop() {
        return this._maxTop
      }
    }
    !(function (t) {
      t.CubismViewMatrix = zs
    })(Os || (Os = {}))
    class js {
      constructor() {
        ;((this._startX = 0),
          (this._startY = 0),
          (this._lastX = 0),
          (this._lastY = 0),
          (this._lastX1 = 0),
          (this._lastY1 = 0),
          (this._lastX2 = 0),
          (this._lastY2 = 0),
          (this._lastTouchDistance = 0),
          (this._deltaX = 0),
          (this._deltaY = 0),
          (this._scale = 1),
          (this._touchSingle = !1),
          (this._flipAvailable = !1))
      }
      getCenterX() {
        return this._lastX
      }
      getCenterY() {
        return this._lastY
      }
      getDeltaX() {
        return this._deltaX
      }
      getDeltaY() {
        return this._deltaY
      }
      getStartX() {
        return this._startX
      }
      getStartY() {
        return this._startY
      }
      getScale() {
        return this._scale
      }
      getX() {
        return this._lastX
      }
      getY() {
        return this._lastY
      }
      getX1() {
        return this._lastX1
      }
      getY1() {
        return this._lastY1
      }
      getX2() {
        return this._lastX2
      }
      getY2() {
        return this._lastY2
      }
      isSingleTouch() {
        return this._touchSingle
      }
      isFlickAvailable() {
        return this._flipAvailable
      }
      disableFlick() {
        this._flipAvailable = !1
      }
      touchesBegan(t, e) {
        ;((this._lastX = t),
          (this._lastY = e),
          (this._startX = t),
          (this._startY = e),
          (this._lastTouchDistance = -1),
          (this._flipAvailable = !0),
          (this._touchSingle = !0))
      }
      touchesMoved(t, e) {
        ;((this._lastX = t),
          (this._lastY = e),
          (this._lastTouchDistance = -1),
          (this._touchSingle = !0))
      }
      getFlickDistance() {
        return this.calculateDistance(this._startX, this._startY, this._lastX, this._lastY)
      }
      calculateDistance(t, e, i, s) {
        return Math.sqrt((t - i) * (t - i) + (e - s) * (e - s))
      }
      calculateMovingAmount(t, e) {
        if (t > 0 != e > 0) return 0
        const i = t > 0 ? 1 : -1,
          s = Math.abs(t),
          r = Math.abs(e)
        return i * (s < r ? s : r)
      }
    }
    class Xs {
      constructor() {
        ;((this._programId = null),
          (this._touchManager = new js()),
          (this._deviceToScreen = new _()),
          (this._viewMatrix = new zs()))
      }
      initialize() {
        const { width: t, height: e } = qs,
          i = t / e,
          s = -i,
          r = i,
          a = Q.ViewLogicalLeft,
          n = Q.ViewLogicalRight
        if (
          (this._viewMatrix.setScreenRect(s, r, a, n),
          this._viewMatrix.scale(Q.ViewScale, Q.ViewScale),
          this._deviceToScreen.loadIdentity(),
          t > e)
        ) {
          const e = Math.abs(r - s)
          this._deviceToScreen.scaleRelative(e / t, -e / t)
        } else {
          const t = Math.abs(n - a)
          this._deviceToScreen.scaleRelative(t / e, -t / e)
        }
        ;(this._deviceToScreen.translateRelative(0.5 * -t, 0.5 * -e),
          this._viewMatrix.setMaxScale(Q.ViewMaxScale),
          this._viewMatrix.setMinScale(Q.ViewMinScale),
          this._viewMatrix.setMaxScreenRect(
            Q.ViewLogicalMaxLeft,
            Q.ViewLogicalMaxRight,
            Q.ViewLogicalMaxBottom,
            Q.ViewLogicalMaxTop
          ))
      }
      release() {
        ;((this._viewMatrix = null),
          (this._touchManager = null),
          (this._deviceToScreen = null),
          Js.deleteProgram(this._programId),
          (this._programId = null))
      }
      render() {
        ;(Js.useProgram(this._programId), Js.flush())
        const t = ks.getInstance()
        ;(t.setViewMatrix(this._viewMatrix), t.onUpdate())
      }
      initializeSprite() {
        ;(qs.width,
          qs.height,
          Zs.getInstance().getTextureManager(),
          Q.ResourcesPath,
          null == this._programId && (this._programId = Zs.getInstance().createShader()))
      }
      onTouchesBegan(t, e) {
        this._touchManager.touchesBegan(t, e)
      }
      onTouchesMoved(t, e) {
        const i = this.transformViewX(this._touchManager.getX()),
          s = this.transformViewY(this._touchManager.getY())
        ;(this._touchManager.touchesMoved(t, e), ks.getInstance().onDrag(i, s))
      }
      onTouchesEnded(t, e) {
        const i = ks.getInstance()
        i.onDrag(0, 0)
        {
          const t = this._deviceToScreen.transformX(this._touchManager.getX()),
            e = this._deviceToScreen.transformY(this._touchManager.getY())
          ;(Q.DebugTouchLogEnable && ws.printMessage(`[APP]touchesEnded x: ${t} y: ${e}`),
            i.onTap(t, e))
        }
      }
      transformViewX(t) {
        const e = this._deviceToScreen.transformX(t)
        return this._viewMatrix.invertTransformX(e)
      }
      transformViewY(t) {
        const e = this._deviceToScreen.transformY(t)
        return this._viewMatrix.invertTransformY(e)
      }
      transformScreenX(t) {
        return this._deviceToScreen.transformX(t)
      }
      transformScreenY(t) {
        return this._deviceToScreen.transformY(t)
      }
    }
    let Gs = null,
      Ys = null
    class Hs {
      constructor() {
        this._messageBox = null
      }
      static getInstance() {
        return (null == Gs && (Gs = new Hs()), Gs)
      }
      getMessageBox() {
        return (
          null == this._messageBox &&
            (this._messageBox = document.querySelector('#live2dMessageBox-content')),
          this._messageBox
        )
      }
      initialize(t) {
        return (
          (Ys = document.createElement('div')),
          (Ys.id = Q.MessageBoxId),
          (Ys.style.position = 'fixed'),
          (Ys.style.padding = '10px'),
          (Ys.style.zIndex = '9999'),
          (Ys.style.display = 'flex'),
          (Ys.style.justifyContent = 'center'),
          (Ys.style.width = t.width + 'px'),
          (Ys.style.height = '20px'),
          (Ys.style.right = '0'),
          (Ys.style.bottom = t.height + 50 + 'px'),
          (Ys.innerHTML = '<div id="live2dMessageBox-content"></div>'),
          document.body.appendChild(Ys),
          this.hideMessageBox(),
          !0
        )
      }
      setMessage(t, e = null) {
        const i = this.getMessageBox()
        ;(this.hideMessageBox(),
          (i.textContent = t),
          setTimeout(() => {
            document.querySelector('#' + Q.MessageBoxId).style.bottom =
              ('auto' === Q.CanvasSize ? 500 : Q.CanvasSize.height) + i.offsetHeight - 25 + 'px'
          }, 10),
          this.revealMessageBox(),
          e &&
            setTimeout(() => {
              this.hideMessageBox()
            }, e))
      }
      hideMessageBox() {
        const t = this.getMessageBox()
        ;(t.classList.remove('live2dMessageBox-content-visible'),
          t.classList.add('live2dMessageBox-content-hidden'))
      }
      revealMessageBox() {
        const t = this.getMessageBox()
        ;(t.classList.remove('live2dMessageBox-content-hidden'),
          t.classList.add('live2dMessageBox-content-visible'))
      }
    }
    let qs = null,
      Ws = null,
      Js = null,
      $s = null
    class Zs {
      static getInstance() {
        return (null == Ws && (Ws = new Zs()), Ws)
      }
      static releaseInstance() {
        ;(null != Ws && Ws.release(), (Ws = null))
      }
      initialize() {
        return (
          (qs = document.createElement('canvas')),
          (qs.id = Q.CanvasId),
          (qs.style.position = 'fixed'),
          (qs.style.bottom = '0'),
          (qs.style.right = '0'),
          (qs.style.zIndex = '9999'),
          (Q.Canvas = qs),
          'auto' === Q.CanvasSize
            ? this._resizeCanvas()
            : ((qs.width = Q.CanvasSize.width), (qs.height = Q.CanvasSize.height)),
          (qs.style.opacity = '0'),
          (qs.style.transition = '.7s cubic-bezier(0.23, 1, 0.32, 1)'),
          (Js = qs.getContext('webgl') || qs.getContext('experimental-webgl')),
          Js
            ? (document.body.appendChild(qs),
              Hs.getInstance().initialize(qs),
              $s || ($s = Js.getParameter(Js.FRAMEBUFFER_BINDING)),
              Js.enable(Js.BLEND),
              Js.blendFunc(Js.SRC_ALPHA, Js.ONE_MINUS_SRC_ALPHA),
              Js.clear(Js.COLOR_BUFFER_BIT | Js.DEPTH_BUFFER_BIT),
              'ontouchend' in qs
                ? ((qs.ontouchstart = er),
                  (qs.ontouchmove = ir),
                  (qs.ontouchend = sr),
                  (qs.ontouchcancel = rr))
                : ((qs.onmousedown = Ks), (qs.onmousemove = Qs), (qs.onmouseup = tr)),
              this._view.initialize(),
              this.initializeCubism(),
              !0)
            : (console.log('Cannot initialize WebGL. This browser does not support.'),
              (Js = null),
              !1)
        )
      }
      onResize() {
        ;(this._resizeCanvas(), this._view.initialize(), this._view.initializeSprite())
        const t = [0, 0, qs.width, qs.height]
        Js.viewport(t[0], t[1], t[2], t[3])
      }
      release() {
        ;(this._textureManager.release(),
          (this._textureManager = null),
          this._view.release(),
          (this._view = null),
          ks.releaseInstance(),
          J.dispose())
      }
      run() {
        const t = () => {
          null != Ws && this._view &&
            (ws.updateTime(),
            Js.clearColor(...Q.BackgroundRGBA),
            Js.enable(Js.DEPTH_TEST),
            Js.depthFunc(Js.LEQUAL),
            Js.clear(Js.COLOR_BUFFER_BIT | Js.DEPTH_BUFFER_BIT),
            Js.clearDepth(1),
            Js.enable(Js.BLEND),
            Js.blendFunc(Js.SRC_ALPHA, Js.ONE_MINUS_SRC_ALPHA),
            this._view.render(),
            requestAnimationFrame(t))
        }
        t()
      }
      createShader() {
        const t = Js.createShader(Js.VERTEX_SHADER)
        if (null == t) return (ws.printMessage('failed to create vertexShader'), null)
        ;(Js.shaderSource(
          t,
          'precision mediump float;attribute vec3 position;attribute vec2 uv;varying vec2 vuv;void main(void){   gl_Position = vec4(position, 1.0);   vuv = uv;}'
        ),
          Js.compileShader(t))
        const e = Js.createShader(Js.FRAGMENT_SHADER)
        if (null == e) return (ws.printMessage('failed to create fragmentShader'), null)
        ;(Js.shaderSource(
          e,
          'precision mediump float;varying vec2 vuv;uniform sampler2D texture;void main(void){   gl_FragColor = texture2D(texture, vuv);}'
        ),
          Js.compileShader(e))
        const i = Js.createProgram()
        return (
          Js.attachShader(i, t),
          Js.attachShader(i, e),
          Js.deleteShader(t),
          Js.deleteShader(e),
          Js.linkProgram(i),
          Js.useProgram(i),
          i
        )
      }
      getView() {
        return this._view
      }
      getTextureManager() {
        return this._textureManager
      }
      constructor() {
        ;((this._captured = !1),
          (this._mouseX = 0),
          (this._mouseY = 0),
          (this._isEnd = !1),
          (this._cubismOption = new $()),
          (this._view = new Xs()),
          (this._textureManager = new Ns()))
      }
      initializeCubism() {
        ;((this._cubismOption.logFunction = ws.printMessage),
          (this._cubismOption.loggingLevel = Q.CubismLoggingLevel),
          J.startUp(this._cubismOption),
          J.initialize(),
          ks.getInstance(),
          ws.updateTime())
      }
      _resizeCanvas() {
        ;((qs.width = window.innerWidth), (qs.height = window.innerHeight))
      }
    }
    function Ks(t) {
      Zs.getInstance()._view
        ? ks.getInstance().model.setRandomExpression()
        : ws.printMessage('view notfound')
    }
    function Qs(t) {
      const e = Zs.getInstance()
      if (!e._view) return void ws.printMessage('view notfound')
      const i = t.target.getBoundingClientRect(),
        s = t.clientX - i.left,
        r = t.clientY - i.top
      e._view.onTouchesMoved(s, r)
    }
    function tr(t) {
      if (((Zs.getInstance()._captured = !1), !Zs.getInstance()._view))
        return void ws.printMessage('view notfound')
      const e = t.target.getBoundingClientRect(),
        i = t.clientX - e.left,
        s = t.clientY - e.top
      Zs.getInstance()._view.onTouchesEnded(i, s)
    }
    function er(t) {
      ws.printMessage('touch event happens')
      const e = Zs.getInstance()
      if (!e._view) return void ws.printMessage('view notfound')
      const i = t.changedTouches[0].pageX,
        s = t.changedTouches[0].pageY
      e._view.onTouchesBegan(i, s)
    }
    function ir(t) {
      if (!Zs.getInstance()._captured) return
      if (!Zs.getInstance()._view) return void ws.printMessage('view notfound')
      const e = t.target.getBoundingClientRect(),
        i = t.changedTouches[0].clientX - e.left,
        s = t.changedTouches[0].clientY - e.top
      Zs.getInstance()._view.onTouchesMoved(i, s)
    }
    function sr(t) {
      if (((Zs.getInstance()._captured = !1), !Zs.getInstance()._view))
        return void ws.printMessage('view notfound')
      const e = t.target.getBoundingClientRect(),
        i = t.changedTouches[0].clientX - e.left,
        s = t.changedTouches[0].clientY - e.top
      Zs.getInstance()._view.onTouchesEnded(i, s)
    }
    function rr(t) {
      if (((Zs.getInstance()._captured = !1), !Zs.getInstance()._view))
        return void ws.printMessage('view notfound')
      const e = t.target.getBoundingClientRect(),
        i = t.changedTouches[0].clientX - e.left,
        s = t.changedTouches[0].clientY - e.top
      Zs.getInstance()._view.onTouchesEnded(i, s)
    }
    var ar = function (t, e, i, s) {
      return new (i || (i = Promise))(function (r, a) {
        function n(t) {
          try {
            l(s.next(t))
          } catch (t) {
            a(t)
          }
        }
        function o(t) {
          try {
            l(s.throw(t))
          } catch (t) {
            a(t)
          }
        }
        function l(t) {
          var e
          t.done
            ? r(t.value)
            : ((e = t.value),
              e instanceof i
                ? e
                : new i(function (t) {
                    t(e)
                  })).then(n, o)
        }
        l((s = s.apply(t, e || [])).next())
      })
    }
    const nr = 20
    let or,
      lr,
      ur = !1,
      hr = 35
    const gr = '__live2d-toolbox-item'
    function dr() {
      or &&
        (lr && clearTimeout(lr),
        (lr = setTimeout(() => {
          or.style.opacity = '1'
        }, 200)))
    }
    function cr() {
      or &&
        !ur &&
        (lr && clearTimeout(lr),
        (lr = setTimeout(() => {
          or.style.opacity = '0'
        }, 200)))
    }
    function _r(t) {
      const e = document.createElement('div')
      return (e.classList.add(gr), t && (e.textContent = t), e)
    }
    function mr() {
      return ar(this, void 0, void 0, function* () {
        const t = Q.Canvas
        ;(!(function () {
          const t = document.createElement('style')
          ;((t.innerHTML = `  \n    .${gr} {\n        margin: 2px;\n        padding: 2px;\n        display: flex;\n        height: 20px;\n        width: 20px;\n        justify-content: center;\n        align-items: center;\n        cursor: pointer;\n        font-size: 0.7rem;\n        background-color: rgb(255, 149, 188);\n        color: white;\n        border-radius: 0.9em;\n        transition: .5s ease;\n    }\n\n    .${gr}:hover {\n        scale: 1.3;\n    }\n    `),
            document.head.appendChild(t))
        })(),
          (or = (function () {
            const t = document.createElement('div')
            ;((t.style.display = 'flex'),
              (t.style.alignItems = 'center'),
              (t.style.justifyContent = 'center'),
              (t.style.flexDirection = 'column'))
            const e = Q.Canvas
            ;((t.style.zIndex = parseInt(e.style.zIndex) + 1 + ''),
              (t.style.opacity = '0'),
              (t.style.transition = '.7s cubic-bezier(0.23, 1, 0.32, 1)'),
              (t.style.position = 'fixed'),
              (t.style.right = e.width - hr + 'px'),
              (t.style.top = window.innerHeight - e.height + 'px'))
            const i = (function (t) {
                const e = _r('➡️')
                ;((e.style.transition = '.5s ease'),
                  (e.style.backgroundColor = '#00A6ED'),
                  (e.style.fontSize = '1.05rem'))
                let i = 0
                return (
                  (e.onclick = () =>
                    ar(this, void 0, void 0, function* () {
                      const s = Q.Canvas
                      if (s) {
                        const r = Math.ceil(s.width)
                        ;((i = (i + r) % (r << 1)),
                          (s.style.transform = `translateX(${i}px)`),
                          (t.style.transform = `translateX(${Math.max(0, i - hr)}px)`),
                          i > 0
                            ? ((ur = !0),
                              (e.style.transform = 'rotate(180deg)'),
                              setTimeout(() => {
                                dr()
                              }, 500))
                            : ((ur = !1), (e.style.transform = 'rotate(0)')))
                      }
                    })),
                  e
                )
              })(t),
              s = (function (t) {
                const e = ks.getInstance(),
                  i = Q.Canvas,
                  s = []
                if (e && i) {
                  const t = Math.max(0, Math.floor(i.height / nr) - 1),
                    r = e.model,
                    a = Math.min(r._expressions.getSize(), t)
                  for (let t = 0; t < a; ++t) {
                    const e = _r('E' + (t + 1)),
                      i = r._expressions._keyValues[t].first
                    ;((e.onclick = () =>
                      ar(this, void 0, void 0, function* () {
                        r.setExpression(i)
                      })),
                      s.push(e))
                  }
                }
                return s
              })()
            return (
              t.appendChild(i),
              s.forEach(e => t.appendChild(e)),
              document.body.appendChild(t),
              t
            )
          })()),
          cr(),
          (or.onmouseenter = () =>
            ar(this, void 0, void 0, function* () {
              dr()
            })),
          (or.onmouseleave = () =>
            ar(this, void 0, void 0, function* () {
              cr()
            })),
          (t.onmouseenter = () =>
            ar(this, void 0, void 0, function* () {
              dr()
            })),
          (t.onmouseleave = () =>
            ar(this, void 0, void 0, function* () {
              cr()
            })))
      })
    }
    var pr = function (t, e, i, s) {
      return new (i || (i = Promise))(function (r, a) {
        function n(t) {
          try {
            l(s.next(t))
          } catch (t) {
            a(t)
          }
        }
        function o(t) {
          try {
            l(s.throw(t))
          } catch (t) {
            a(t)
          }
        }
        function l(t) {
          var e
          t.done
            ? r(t.value)
            : ((e = t.value),
              e instanceof i
                ? e
                : new i(function (t) {
                    t(e)
                  })).then(n, o)
        }
        l((s = s.apply(t, e || [])).next())
      })
    }
    function fr(t) {
      const e = ks.getInstance()
      e && e.model.setExpression(t)
    }
    function yr() {
      const t = ks.getInstance()
      t && t.model.setRandomExpression()
    }
    function Sr(t, e) {
      Hs.getInstance().setMessage(t, e)
    }
    function xr() {
      Hs.getInstance().hideMessageBox()
    }
    function Cr() {
      Hs.getInstance().revealMessageBox()
    }
    function Br(t) {
      const e = document.createElement('script')
      return (
        (e.src = t),
        new Promise((t, i) => {
          ;((e.onload = () => {
            t()
          }),
            (e.onerror = t => {
              i(t)
            }),
            document.head.appendChild(e))
        })
      )
    }
    function Mr(t) {
      return pr(this, void 0, void 0, function* () {
        if (
          (void 0 === t.MinifiedJSUrl &&
            (t.MinifiedJSUrl = 'https://unpkg.com/core-js-bundle@3.6.1/minified.js'),
          void 0 === t.Live2dCubismcoreUrl &&
            (t.Live2dCubismcoreUrl =
              'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js'),
          void 0 === t.ShowToolBox && (t.ShowToolBox = !1),
          (Q.ShowToolBox = t.ShowToolBox),
          yield (function (t) {
            return pr(this, void 0, void 0, function* () {
              const e = []
              for (const i of t) e.push(Br(i))
              for (const t of e) yield t
            })
          })([t.MinifiedJSUrl, t.Live2dCubismcoreUrl]),
          t.CanvasId && (Q.CanvasId = t.CanvasId),
          t.CanvasSize && (Q.CanvasSize = t.CanvasSize),
          t.BackgroundRGBA && (Q.BackgroundRGBA = t.BackgroundRGBA),
          t.ResourcesPath && (Q.ResourcesPath = t.ResourcesPath),
          t.LoadFromCache && window.indexedDB)
        ) {
          Q.LoadFromCache = t.LoadFromCache
          const i = yield ('db',
          1,
          (e = 'live2d'),
          new Promise((t, i) => {
            void 0 === window.indexedDB && t(void 0)
            const s = indexedDB.open('db', 1)
            ;((s.onsuccess = e => {
              const i = e.currentTarget.result
              t(i)
            }),
              (s.onerror = e => {
                const i = e.currentTarget.error
                ;(console.log('[live2d] 打开 indexDB 错误。' + i.message), t(void 0))
              }),
              (s.onupgradeneeded = t => {
                const i = t.currentTarget.result
                if (e && !i.objectStoreNames.contains(e)) {
                  const t = i.createObjectStore(e, { autoIncrement: !0 })
                  ;(t.createIndex('url', 'url', { unique: !0 }),
                    t.createIndex('arraybuffer', 'arraybuffer'))
                }
              }))
          }))
          Q.Live2dDB = i
        }
        var e
        return (function () {
          return pr(this, void 0, void 0, function* () {
            const t = Zs.getInstance()
            t.initialize()
              ? (t.run(),
                Q.Canvas &&
                  setTimeout(() => {
                    ;((Q.Canvas.style.opacity = '1'), Q.ShowToolBox && mr())
                  }, 500))
              : console.log('初始化失败，退出')
          })
        })()
      })
    }
    return (
      window &&
        ((window.onbeforeunload = () => {
          const t = Zs.getInstance()
          t && t.release()
        }),
        (window.onresize = () => {
          const t = Zs.getInstance()
          t && 'auto' === Q.CanvasSize && t.onResize()
        })),
      l
    )
  })()
})
const url = 'https://raw.githubusercontent.com/kr37t1k/live2d-python/refs/heads/main/models/%E9%A6%99%E9%A2%A8%E6%99%BA%E4%B9%83/%E9%A6%99%E9%A2%A8%E6%99%BA%E4%B9%83.model3.json'
window.Live2dRender.initializeLive2D({
    // live2d 所在区域的背景颜色
    BackgroundRGBA: [0.0, 0.0, 0.0, 0.0],

    // live2d 的 model3.json 文件的相对路径
    ResourcesPath: url,

    // live2d 的大小
    CanvasSize: {
      height: 500,
      width: 400
    },

    ShowToolBox: true,

    // 是否使用 indexDB 进行缓存优化，这样下一次载入就不会再发起网络请求了
    LoadFromCache: true
  }).then(() => {
    console.log('finish load')
  })