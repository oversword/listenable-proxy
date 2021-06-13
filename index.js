class Events {
	#callbacks = {}

	constructor(allowedEvents = []) {
		allowedEvents.forEach(allowedEvent => {
			this.#callbacks[allowedEvent] = []
		})
	}
	dispatch(event) {
		if (!(event.type in this.#callbacks))
			throw new Error(`Event type must be one of: ${Object.keys(this.#callbacks).join(", ")}.`)
		this.#callbacks[event.type].forEach(f => {
			f(event)
		})
	}
	bind(...args) {
		if (args[0] instanceof Function) {
			Object.keys(this.#callbacks).forEach(key => {
				this.#callbacks[key].push(args[0])
			})
		} else
		if (!(args[1] instanceof Function))
			throw new Error(`Second argument to ListenableProxy call must be a Function.`)
		else
		if (!(args[0] in this.#callbacks))
			throw new Error(`Event type must be one of: ${Object.keys(this.#callbacks).join(", ")}.`)
		else this.#callbacks[args[0]].push(args[1])
	}
	unbind(...args) {
		if (args[0] instanceof Function) {
			Object.keys(this.#callbacks).forEach(key => {
				array_remove(this.#callbacks[key], args[0])
			})
		} else
		if (!(args[0] in this.#callbacks))
			throw new Error(`Event type must be one of: ${Object.keys(this.#callbacks).join(", ")}.`)
		else array_remove(this.#callbacks[args[0]], args[1])
	}
	hasEvent(eventName) {
		return eventName in this.#callbacks
	}
}

function ListenableProxy(target, allowedKeys = false) {
	/* AllowedKeys:
		false	= allow any
		true	= only allow existing keys
		Array	= allow any in array
		RegExp	= allow keys matching pattern
		Function= return value allows if truthy: (key: string) => boolean
	*/
	if (allowedKeys === true)
		allowedKeys = Object.keys(target)
	if (allowedKeys instanceof Array)
		allowedKeys = allowedKeys.map(String)

	const events = new Events(["get","set","delete","create","update"])
	const _f = () => {}
	Object.keys(target).forEach(key => {
		_f[key] = _f[key] || undefined
	})

	const isKeyAllowed = key => {
		if (allowedKeys === false) return true

		if (allowedKeys instanceof Function) {
			if (! allowedKeys(key))
				return false
		}
		if (allowedKeys instanceof Array) {
			if (! allowedKeys.includes(key))
				return false
		} else
		if (allowedKeys instanceof RegExp) {
			if (! key.match(allowedKeys))
				return false
		}

		return true
	}

	return new Proxy(_f, {
		deleteProperty (_f, key) {
			const event = {
				type: "delete",
				key,
				value: target[key],
				success: false
			}
			if (!(key in target)) {
				events.dispatch(event)
				return false
			}
			const deleted = delete target[key]
			if (deleted) {
				event.success = true
				delete _f[key]
			}
			events.dispatch(event)
			return deleted
		},
		enumerate () {
			return Object.keys(target);
		},
		ownKeys () {
			return Object.keys(target);
		},
		has (_f, key) {
			return key in target
		},
		set (_f, key, value) {
			const event = {
				type: "set",
				key,
				value,
				startValue: target[key],
				success: false
			}
			if (! isKeyAllowed(key)) {
				events.dispatch(event)
				return false
			}

			const existed = key in target
			const updated = value !== target[key]
			target[key] = value
			_f[key] = _f[key] || undefined
			event.success = true
			if (! existed)
				events.dispatch({
					...event,
					type: "create"
				})
			else
			if (updated)
				events.dispatch({
					...event,
					type: "update"
				})
			events.dispatch(event)
			return true
		},
		get (_f, key) {
			const value = target[key]
			const event = {
				type: "get",
				key,
				value,
				success: false
			}
			if (! isKeyAllowed(key)) {
				events.dispatch(event)
				return undefined
			}
			event.success = true
			events.dispatch(event)
			return value
		},
		apply (_f, _n, args) {
			if (args[0] === "unbind")
				return events.unbind(...args.slice(1))
			return events.bind(...args)
		},
		// defineProperty: function (_f, ...a) {
			// TODO: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty
			// when ?
			// console.log("define",a)
			// if (oDesc && 'value' in oDesc) { oTarget.setItem(sKey, oDesc.value); }
			// return oTarget;
		// },
		// construct (...a) {
		// 	clone?
		// 	console.log("contruct", a)
		// },
	})
}

export default ListenableProxy