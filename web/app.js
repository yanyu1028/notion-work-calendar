
;(() => {
const InlineChartRuntime = (() => {
	if (typeof Chart !== "undefined" && Chart.defaults?.datasets?.line) {
		Chart.defaults.datasets.line.clip = 8
	}
	const strip = n => n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")
	const compact = v => {
		const a = Math.abs(v)
		if (a >= 1e12) return strip(a / 1e12) + "T"
		if (a >= 1e9) return strip(a / 1e9) + "B"
		if (a >= 1e6) return strip(a / 1e6) + "M"
		if (a >= 1e3) return strip(a / 1e3) + "K"
		return strip(a)
	}
	const currency = v => {
		const a = Math.abs(v)
		if (a === 0 || a >= 1) return compact(a)
		return a.toLocaleString("en-US", { maximumSignificantDigits: 3 })
	}
	const formatValue = (v, kind) => {
		if (v === null || v === undefined) return "Not available"
		if (typeof v !== "number" || !Number.isFinite(v)) {
			throw new Error("Non-finite chart value")
		}
		switch (kind) {
			case "currency":
				return (v < 0 ? "-" : "") + "$" + currency(v)
			case "count":
				return Math.round(v).toLocaleString("en-US")
			case "countCompact":
			case "numberCompact":
				return (v < 0 ? "-" : "") + compact(v)
			case "percent":
				return strip(v) + "%"
			case "percentagePoint":
				return strip(v) + " percentage points"
			case "ratio":
				return strip(v) + "×"
			case "durationMs":
				return Math.abs(v) < 1000 ? strip(v) + " ms" : strip(v / 1000) + " s"
			case "number":
				return Number(strip(v)).toLocaleString("en-US", {
					maximumFractionDigits: 2,
				})
			default:
				throw new Error("Unknown chart value kind: " + kind)
		}
	}
	const axisRange = (lo, hi, opts) => {
		const o = opts || {}
		if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo > hi) {
			throw new Error("Axis range requires finite ordered values")
		}
		const target = o.target === undefined ? 5 : o.target
		if (!Number.isInteger(target) || target < 4 || target > 6) {
			throw new Error("Axis target must be an integer from 4 through 6")
		}
		const observedLo = lo
		const observedHi = hi
		if (Number.isFinite(o.floor) && o.floor > observedLo) {
			throw new Error("Axis floor excludes observed values")
		}
		if (Number.isFinite(o.cap) && o.cap < observedHi) {
			throw new Error("Axis cap excludes observed values")
		}
		if (o.zero) {
			lo = Math.min(0, lo)
			hi = Math.max(0, hi)
		}
		if (Number.isFinite(o.floor)) lo = o.floor
		if (hi === lo) {
			const pad = Math.abs(lo) * 0.06 || 1
			if (Number.isFinite(o.cap)) lo -= pad
			else hi += pad
		}
		const zeroIsUpperBound = o.zero && observedHi < 0
		const paddedHi = zeroIsUpperBound ? hi : hi + (hi - lo) * 0.06
		const span = paddedHi - lo || 1
		const exponent = Math.floor(Math.log10(span))
		const candidates = []
		for (let power = exponent - 3; power <= exponent + 1; power += 1) {
			for (const multiplier of [1, 2, 2.5, 5]) {
				const step = Number((multiplier * 10 ** power).toPrecision(12))
				let min
				let max
				if (Number.isFinite(o.floor)) {
					min = o.floor
					max = Number.isFinite(o.cap)
						? o.cap
						: Number(
								(
									min +
									Math.ceil((paddedHi - min) / step - 1e-9) * step
								).toPrecision(12),
							)
				} else if (Number.isFinite(o.cap)) {
					max = o.cap
					min = Number(
						(max - Math.ceil((max - lo) / step - 1e-9) * step).toPrecision(12),
					)
				} else {
					min = Number((Math.floor(lo / step + 1e-9) * step).toPrecision(12))
					max = Number(
						(
							min +
							Math.ceil((paddedHi - min) / step - 1e-9) * step
						).toPrecision(12),
					)
				}
				if (
					o.tight === true &&
					observedLo < 0 &&
					observedHi > 0 &&
					!Number.isFinite(o.floor) &&
					!Number.isFinite(o.cap)
				) {
					const pad = (observedHi - observedLo) * 0.06
					const tightMin = observedLo - pad
					const tightMax = observedHi + pad
					const ticks =
						Math.floor(tightMax / step + 1e-9) -
						Math.ceil(tightMin / step - 1e-9) +
						1
					if (ticks >= 4 && ticks <= 6) {
						candidates.push({
							min: tightMin,
							max: tightMax,
							step,
							includeBounds: false,
							score: Math.abs(ticks - target) * 0.1 + (2 * pad) / span,
						})
					}
				}
				const intervals = (max - min) / step
				const tickCount = Math.round(intervals) + 1
				if (
					Math.abs(intervals - Math.round(intervals)) < 1e-9 &&
					tickCount >= 4 &&
					tickCount <= 6 &&
					min <= observedLo &&
					max >= observedHi
				) {
					candidates.push({
						min,
						max,
						step,
						score:
							Math.abs(tickCount - target) * 0.1 +
							(max - min - (observedHi - observedLo)) / span,
					})
				}
			}
		}
		candidates.sort((a, b) => a.score - b.score || a.step - b.step)
		const range = candidates[0]
		if (!range) {
			throw new Error("Axis range cannot produce 4-6 aligned ticks")
		}
		if (o.zero && observedLo >= 0 && range.min < 0) {
			throw new Error(
				"Axis cap cannot preserve a zero baseline with 4-6 aligned ticks",
			)
		}
		if (range.includeBounds === false) {
			return {
				min: range.min,
				max: range.max,
				step: range.step,
				includeBounds: false,
			}
		}
		return { min: range.min, max: range.max, step: range.step }
	}
	const barPath = (x, w, y, y0, r) =>
		y0 - y < 8
			? "M " + x + " " + y0 + " V " + y + " H " + (x + w) + " V " + y0 + " Z"
			: "M " +
				x +
				" " +
				y0 +
				" V " +
				(y + r) +
				" Q " +
				x +
				" " +
				y +
				", " +
				(x + r) +
				" " +
				y +
				" H " +
				(x + w - r) +
				" Q " +
				(x + w) +
				" " +
				y +
				", " +
				(x + w) +
				" " +
				(y + r) +
				" V " +
				y0 +
				" Z"
	const lineLayout = (P, n) => {
		const inset = 8
		const left = P.left + inset
		const right = P.left + P.width - inset
		const xFor = i =>
			n === 1 ? (left + right) / 2 : left + ((right - left) / (n - 1)) * i
		const labelXFor = i =>
			i === 0 ? P.left : i === n - 1 ? P.left + P.width : xFor(i)
		const labelAnchorFor = i =>
			i === 0 ? "start" : i === n - 1 ? "end" : "middle"
		return { xFor, labelXFor, labelAnchorFor }
	}
	const cssVar = name =>
		getComputedStyle(document.documentElement).getPropertyValue(name).trim()
	const buildTooltip = (tip, title, rows) => {
		tip.textContent = ""
		const addDiv = (className, text) => {
			const node = document.createElement("div")
			node.className = className
			node.textContent = text
			tip.appendChild(node)
			return node
		}
		addDiv("tip-title", title)
		for (const item of rows) {
			if (Object.prototype.hasOwnProperty.call(item, "extra")) {
				addDiv("tip-extra", item.extra)
				continue
			}
			const row = addDiv("tip-row", "")
			const key = document.createElement("span")
			key.className = "tip-key"
			key.dataset.mark = item.mark || "square"
			key.style.background = item.color
			const label = document.createElement("span")
			label.className = "tip-label"
			label.textContent = item.label
			const value = document.createElement("span")
			value.className = "tip-value"
			value.textContent = item.value
			row.append(key, label, value)
		}
	}
	const positionTooltip = (tip, container, x, y) => {
		const left = Math.max(
			4,
			Math.min(x + 10, container.clientWidth - tip.offsetWidth - 4),
		)
		const above = y - tip.offsetHeight - 10
		// A below-pointer tooltip can otherwise enlarge an auto-sized artifact.
		const top = Math.max(
			4,
			Math.min(
				above >= 4 ? above : y + 10,
				container.clientHeight - tip.offsetHeight - 4,
			),
		)
		tip.style.left = left + "px"
		tip.style.top = top + "px"
	}
	const createAuditRetry = (host, maxRetries, delays, onFinalFail) => {
		let retries = 0
		let pending = false
		let timer = 0
		const schedule = (delay, action) => {
			pending = true
			timer = globalThis.setTimeout(() => {
				pending = false
				if (host?.isConnected === false || host?.dataset?.auditFailed) return
				action()
			}, delay)
		}
		const reset = () => {
			if (timer) globalThis.clearTimeout(timer)
			retries = 0
			pending = false
			timer = 0
		}
		const fail = (reason, onRetry) => {
			if (host?.dataset?.auditFailed || pending) return false
			if (retries < maxRetries) {
				const delay = delays[Math.min(retries, delays.length - 1)] || 0
				retries += 1
				schedule(delay, onRetry)
				return false
			}
			onFinalFail(reason)
			return false
		}
		const runAll = action => {
			let index = 0
			const next = () => {
				if (index >= maxRetries) return
				const delay = delays[Math.min(index, delays.length - 1)] || 0
				index += 1
				schedule(delay, () => {
					action()
					next()
				})
			}
			next()
		}
		return { fail, reset, runAll }
	}
	const createTooltip =
		(formatTitle, contextLabel = "") =>
		context => {
			const { chart, tooltip } = context
			const container = chart.canvas.parentElement
			const tip = container.querySelector(".chart-tooltip")
			if (!tooltip || tooltip.opacity === 0) {
				tip.dataset.visible = "false"
				tip.setAttribute("aria-hidden", "true")
				return
			}
			const rows = tooltip.dataPoints.flatMap(point => {
				const isLine = (point.dataset.type ?? chart.config.type) === "line"
				const rawColor = isLine
					? point.dataset.borderColor
					: point.dataset.backgroundColor
				const color = Array.isArray(rawColor)
					? rawColor[point.dataIndex]
					: rawColor
				let mark = "square"
				if (isLine) mark = "line"
				if (point.dataset.borderDash) mark = "dashed"
				const isXY =
					point.raw !== null &&
					typeof point.raw === "object" &&
					Object.prototype.hasOwnProperty.call(point.raw, "y")
				const row = {
					color,
					mark,
					label: point.dataset.label,
					value: formatValue(
						isXY ? point.raw.y : point.raw,
						point.dataset.valueKind,
					),
				}
				if (isXY && typeof point.dataset.xSeriesKey === "string") {
					return [
						{
							color,
							mark,
							label: point.dataset.xSeriesKey,
							value: formatValue(point.raw.x, point.dataset.xValueKind),
						},
						row,
					]
				}
				return [row]
			})
			if (contextLabel !== "") rows.push({ extra: contextLabel })
			const pointLabel =
				chart.data.labels?.[tooltip.dataPoints[0]?.dataIndex] ?? ""
			buildTooltip(tip, formatTitle(tooltip.title[0] || pointLabel), rows)
			tip.dataset.visible = "true"
			tip.setAttribute("aria-hidden", "false")
			positionTooltip(
				tip,
				container,
				chart.canvas.offsetLeft + tooltip.caretX,
				chart.canvas.offsetTop + tooltip.caretY,
			)
		}
	const crosshair = {
		id: "crosshair",
		beforeDatasetsDraw: chart => {
			const active = chart.tooltip?.getActiveElements?.() ?? []
			if (!active.length) return
			const x = active[0].element.x
			const area = chart.chartArea
			const ctx = chart.ctx
			ctx.save()
			ctx.beginPath()
			ctx.moveTo(x, area.top)
			ctx.lineTo(x, area.bottom)
			ctx.lineWidth = 1
			ctx.strokeStyle = cssVar("--border-strong") || "rgba(25,25,24,0.2)"
			ctx.stroke()
			ctx.restore()
		},
	}
	const stabilizationCleanup = new WeakMap()
	const createChartAudit = spec => {
		let retry
		const unsafeReason = chart => {
			const kinds = [
				...new Set(chart.data.datasets.map(dataset => dataset.valueKind)),
			]
			if (kinds.length !== 1 || !kinds[0]) {
				return "every dataset must declare one shared valueKind"
			}
			if (spec.valueKind && kinds[0] !== spec.valueKind) {
				return "axis expects valueKind " + spec.valueKind + ", got " + kinds[0]
			}
			for (const dataset of chart.data.datasets) {
				for (const value of dataset.data) {
					const parts =
						value !== null &&
						typeof value === "object" &&
						Object.prototype.hasOwnProperty.call(value, "x") &&
						Object.prototype.hasOwnProperty.call(value, "y")
							? [value.x, value.y]
							: Array.isArray(value)
								? value
								: [value]
					for (const part of parts) {
						if (part === null) continue
						if (typeof part !== "number" || !Number.isFinite(part)) {
							return "non-finite data value; missing must be null"
						}
					}
				}
			}
			const axisName = spec.valueAxis || "y"
			if (!chart.scales[axisName]) return "missing value axis " + axisName
			return ""
		}
		const policyReason = chart => {
			const kind = chart.data.datasets[0]?.valueKind
			const axis = chart.scales[spec.valueAxis || "y"]
			if (axis.ticks.length < 4 || axis.ticks.length > 6) {
				return "value axis needs 4-6 ticks, has " + axis.ticks.length
			}
			if (
				["count", "currency", "number"].includes(kind) &&
				Math.max(Math.abs(axis.min), Math.abs(axis.max)) >= 10000
			) {
				for (const tick of axis.ticks) {
					if (/[\d,]{5}/.test(String(tick.label).split(".")[0])) {
						return (
							"axis ticks must use compact formatting above 10K, found " +
							tick.label
						)
					}
				}
			}
			if (chart.options.animation !== false) return "animation must be false"
			if (chart.options.plugins?.tooltip?.enabled !== false) {
				return "canvas tooltip must be disabled (use the external tooltip)"
			}
			if (chart.config.type === "bar") {
				const meta = chart.getDatasetMeta(0)
				for (const element of meta.data) {
					const thickness =
						chart.options.indexAxis === "y" ? element.height : element.width
					if (thickness > 64) return "bar thickness exceeds the 64px cap"
				}
			}
			return ""
		}
		return {
			id: "audit",
			afterDestroy: chart => {
				retry?.reset()
				stabilizationCleanup.get(chart)?.()
				stabilizationCleanup.delete(chart)
			},
			afterUpdate: chart => {
				const host = chart.canvas.parentElement
				if (!host || host.dataset.auditFailed) return
				if (!retry) {
					retry = createAuditRetry(host, 2, [100, 500], reason => {
						host.dataset.auditFailed = "true"
						host.dataset.auditReason = reason
						host.textContent = "Chart failed validation: " + reason
					})
				}
				const unsafe = unsafeReason(chart)
				const policy = unsafe ? "" : policyReason(chart)
				if (policy) host.dataset.auditPolicy = policy
				else delete host.dataset.auditPolicy
				if (unsafe) {
					retry.fail(unsafe, () => {
						if (!chart.canvas?.isConnected || host.dataset.auditFailed) return
						chart.resize()
						chart.update("none")
					})
					return
				}
				retry.reset()
			},
		}
	}
	const stabilize = chart => {
		stabilizationCleanup.get(chart)?.()
		let frame = 0
		const host = chart.canvas.parentElement
		const retry = createAuditRetry(host, 2, [100, 500], () => {})
		const redraw = () => {
			frame = 0
			if (chart.canvas === null || !host.isConnected) return
			chart.draw()
			const canvas = chart.canvas
			canvas.style.opacity = canvas.style.opacity === "0.999" ? "1" : "0.999"
		}
		const scheduleRedraw = () => {
			if (frame) cancelAnimationFrame(frame)
			frame = requestAnimationFrame(() => {
				frame = requestAnimationFrame(redraw)
			})
		}
		const settle = () => {
			scheduleRedraw()
			retry.runAll(redraw)
		}
		const observer =
			typeof ResizeObserver === "undefined"
				? undefined
				: new ResizeObserver(scheduleRedraw)
		observer?.observe(host)
		stabilizationCleanup.set(chart, () => {
			if (frame) cancelAnimationFrame(frame)
			retry.reset()
			observer?.disconnect()
			window.removeEventListener("load", settle)
			window.removeEventListener("resize", scheduleRedraw)
		})
		if (document.readyState === "complete") settle()
		else window.addEventListener("load", settle, { once: true })
		window.addEventListener("resize", scheduleRedraw)
		return chart
	}
	const createLegendToggles = (chart, legendEl) => {
		chart.data.datasets.forEach((dataset, index) => {
			const button = document.createElement("button")
			button.type = "button"
			button.className = "legend-toggle"
			button.setAttribute("aria-pressed", "true")
			const isLine = chart.config.type === "line"
			const key = document.createElement("span")
			key.className = isLine ? "key-line" : "key-sq"
			if (dataset.borderDash) key.dataset.dash = "dashed"
			const color = dataset.borderColor || dataset.backgroundColor
			if (isLine) key.style.borderTopColor = color
			else key.style.background = color
			const label = document.createElement("span")
			label.textContent = dataset.label
			button.append(key, label)
			button.addEventListener("click", () => {
				const visible = chart.data.datasets.map((value, datasetIndex) =>
					chart.isDatasetVisible(datasetIndex),
				)
				visible[index] = !visible[index]
				if (!visible.some(Boolean)) return
				chart.setDatasetVisibility(index, visible[index])
				button.setAttribute("aria-pressed", String(visible[index]))
				chart.update("none")
			})
			legendEl.appendChild(button)
		})
	}
	const SVGNS = "http://www.w3.org/2000/svg"
	const el = (tag, attrs, parent) => {
		const node = document.createElementNS(SVGNS, tag)
		for (const key in attrs) node.setAttribute(key, attrs[key])
		if (parent) parent.appendChild(node)
		return node
	}
	const attachTooltip = (plot, onLineIndex) => {
		const tip = plot.querySelector(".chart-tooltip")
		const guide = plot.querySelector(".guide")
		const hide = () => {
			tip.dataset.visible = "false"
			tip.setAttribute("aria-hidden", "true")
			if (guide) guide.setAttribute("visibility", "hidden")
		}
		const show = (mark, clientX, clientY) => {
			const bounds = plot.getBoundingClientRect()
			let title = mark.dataset.heading
			let rows = [
				{
					color: "var(" + mark.dataset.color + ")",
					mark: mark.dataset.mark || "square",
					label: mark.dataset.label,
					value: mark.dataset.value,
				},
			]
			if (mark.dataset.extra) rows.push({ extra: mark.dataset.extra })
			if (mark.dataset.kind === "line" && onLineIndex) {
				const detail = onLineIndex(Number(mark.dataset.index), guide)
				if (Array.isArray(detail)) rows = detail
				else if (detail) {
					title = detail.title || title
					rows = detail.rows || rows
				}
			}
			buildTooltip(tip, title, rows)
			tip.dataset.visible = "true"
			tip.setAttribute("aria-hidden", "false")
			positionTooltip(tip, plot, clientX - bounds.left, clientY - bounds.top)
		}
		plot.addEventListener("pointermove", event => {
			const mark = event.target.closest
				? event.target.closest(".data-mark")
				: null
			if (mark) show(mark, event.clientX, event.clientY)
			else hide()
		})
		plot.addEventListener("pointerleave", hide)
		plot.addEventListener("focusin", event => {
			const mark = event.target.closest(".data-mark")
			if (!mark) return
			const bounds = mark.getBoundingClientRect()
			show(mark, bounds.left + bounds.width / 2, bounds.top)
		})
		plot.addEventListener("focusout", hide)
	}
	const svgAuditRetries = new WeakMap()
	const svgAudit = (plot, expectedMarks, rerender) => {
		let retry = svgAuditRetries.get(plot)
		if (!retry) {
			retry = createAuditRetry(plot, 2, [100, 500], reason => {
				plot.dataset.auditFailed = "true"
				plot.dataset.auditReason = reason
				plot.textContent = "Chart failed validation: " + reason
			})
			svgAuditRetries.set(plot, retry)
		}
		const fail = reason => retry.fail(reason, rerender)
		const svgNode = plot.querySelector("svg")
		if (!svgNode) return fail("missing svg")
		const marks = svgNode.querySelectorAll(".data-mark").length
		if (marks !== expectedMarks) {
			return fail("expected " + expectedMarks + " marks, found " + marks)
		}
		const rect = svgNode.getBoundingClientRect()
		const viewBox = (svgNode.getAttribute("viewBox") || "")
			.split(/[\s,]+/)
			.map(Number)
		if (rect.width > 0 && viewBox.length === 4 && viewBox[2] > 0) {
			const scale = rect.width / viewBox[2]
			for (const text of svgNode.querySelectorAll("text")) {
				const fontSize = parseFloat(getComputedStyle(text).fontSize || "12")
				if (fontSize * scale < 11) {
					return fail("effective text size below 11px after viewBox scaling")
				}
			}
			for (const text of svgNode.querySelectorAll("text")) {
				try {
					const box = text.getBBox()
					if (box.x < -1 || box.x + box.width > viewBox[2] + 1) {
						return fail("text clips at the plot edge: " + text.textContent)
					}
				} catch (error) {
					if (error instanceof TypeError || error instanceof DOMException) break
					throw error
				}
			}
			const labels = [...svgNode.querySelectorAll(".x-text")]
			for (let index = 1; index < labels.length; index += 1) {
				try {
					const previous = labels[index - 1].getBBox()
					const current = labels[index].getBBox()
					if (
						previous.x + previous.width > current.x &&
						current.x + current.width > previous.x
					) {
						return fail("category labels overlap")
					}
				} catch (error) {
					if (error instanceof TypeError || error instanceof DOMException) break
					throw error
				}
			}
		}
		retry.reset()
		delete plot.dataset.auditRetries
		delete plot.dataset.auditRetryPending
		return true
	}
	const chartJs = {
		createTooltip,
		crosshair,
		createAudit: createChartAudit,
		stabilize,
		createLegendToggles,
	}
	const svg = { el, attachTooltip, audit: svgAudit }
	return {
		formatValue,
		axisRange,
		barPath,
		lineLayout,
		cssVar,
		buildTooltip,
		positionTooltip,
		createAuditRetry,
		chartJs,
		svg,
	}
})()

let initialChart;
const initializeDashboard=payload=>{
let data=payload.records;const meta={...payload.meta};
const $=id=>document.getElementById(id);
const label={note:'笔记',task:'任务',project:'项目'};
const fmt=v=>InlineChartRuntime.formatValue(v,'count');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const parse=s=>new Date(s+'T00:00:00Z'),iso=d=>d.toISOString().slice(0,10);
const add=(d,n)=>new Date(d.getTime()+n*86400000),first=(y,m)=>new Date(Date.UTC(y,m,1)),last=(y,m)=>new Date(Date.UTC(y,m+1,0));
const state={mode:'month',anchor:parse(meta.snapshot_date),dateMode:'due',sources:new Set(['note','task','project']),side:{type:'date',date:meta.snapshot_date},selectedDate:meta.snapshot_date,history:[],theme:'auto',nodeFilter:'all',statusFilter:'all',sortKey:'start',sortDirection:'asc',sortGroup:true,nameWidth:240,fields:{project:[],task:[],note:[]}};
const isoWeek=d=>{const t=parse(d),day=(t.getUTCDay()+6)%7;t.setUTCDate(t.getUTCDate()+3-day);const year=t.getUTCFullYear(),a=new Date(Date.UTC(year,0,4));a.setUTCDate(a.getUTCDate()+3-((a.getUTCDay()+6)%7));return {year,week:1+Math.round((t-a)/604800000)};};
const statSpecs={project_start:{kind:'project',date:'start_date',label:'开始项目'},project_due:{kind:'project',date:'due_date',label:'到期项目'},task_start:{kind:'task',date:'start_date',label:'开始任务'},task_due:{kind:'task',date:'due_date',label:'到期任务'},note_created:{kind:'note',date:'start_date',label:'创建笔记'}};
const statSpec=()=>statSpecs[$('stats-source').value]||statSpecs.task_due;
const statDate=r=>r[statSpec().date];
const statRows=()=>{const [lo,hi]=period(),spec=statSpec();return data.filter(r=>r.kind===spec.kind&&matches(r)&&r[spec.date]&&r[spec.date]>=lo&&r[spec.date]<=hi);};
const fieldOptions={project:[['start','开始日期'],['due','截止日期'],['category','项目类别'],['priority','优先级']],task:[['start','开始日期'],['due','截止日期'],['category','任务类别'],['priority','优先级'],['projects','所属项目']],note:[['start','创建日期'],['category','笔记类型'],['projects','关联项目'],['related','关联任务']]};
const fieldValue=(r,key)=>key==='start'?r.start_date:key==='due'?r.due_date:key==='projects'?names(r.effective_projects).join('、'):key==='related'?names(r.related.filter(u=>byUrl.get(u)?.kind==='task')).join('、'):r[key];
const recordFields=r=>(state.fields[r.kind]||[]).map(key=>{const v=fieldValue(r,key),name=fieldOptions[r.kind].find(([k])=>k===key)?.[1];return v?`${esc(name)}：${esc(v)}`:'';}).filter(Boolean).join(' · ');
const syncNodeFilters=()=>{
 const noStatus=state.nodeFilter==='note';
 $('node-filter').value=state.nodeFilter;$('status-filter').disabled=noStatus;
 $('status-filter').value=noStatus?'all':state.statusFilter;
 $('status-filter').title=noStatus?'此类节点不适用状态筛选':state.nodeFilter==='all'?'状态筛选仅作用于项目和任务；笔记不受影响':'按当前状态筛选';
 $('status-filter-hint').textContent=$('status-filter').title;
 state.sources=new Set(state.nodeFilter==='all'?['project','task','note']:[state.nodeFilter]);
};
const restoreNodeFilters=()=>{state.nodeFilter='all';state.statusFilter='all';renderAll();};
const filterDescription=()=>[$('node-filter').selectedOptions[0]?.textContent,state.statusFilter==='all'||state.nodeFilter==='note'?'':state.statusFilter,$('search').value?'搜索“'+$('search').value+'”':''].filter(Boolean).join(' · ');
const storageKey='notion-calendar-ui-v1';
const saveSettings=()=>{try{localStorage.setItem(storageKey,JSON.stringify({dateMode:state.dateMode,mode:state.mode,nodeFilter:state.nodeFilter,statusFilter:state.statusFilter,sortKey:state.sortKey,sortDirection:state.sortDirection,sortGroup:state.sortGroup,fields:state.fields,theme:state.theme,nameWidth:state.nameWidth,search:$('search').value,searchMode:$('search-mode').value,condition:$('search-condition').value,scope:$('search-scope').value,stat:$('stats-source').value}));}catch{}};
const loadSettings=()=>{try{
 const c=JSON.parse(localStorage.getItem(storageKey)||'null');if(!c)return;
 if(['start','due','continuous'].includes(c.dateMode))state.dateMode=c.dateMode;
 if(['week','month','quarter','year'].includes(c.mode))state.mode=c.mode;
 if(['all','project','task','note'].includes(c.nodeFilter))state.nodeFilter=c.nodeFilter;
 if(['all','进行中','未开始','已归档'].includes(c.statusFilter))state.statusFilter=c.statusFilter;
 if(['start','due','duration','status','priority','title'].includes(c.sortKey))state.sortKey=c.sortKey;
 state.sortDirection=c.sortDirection==='desc'?'desc':'asc';state.sortGroup=c.sortGroup!==false;
 for(const kind of ['project','task','note'])if(Array.isArray(c.fields?.[kind]))state.fields[kind]=c.fields[kind].filter(k=>fieldOptions[kind].some(([v])=>v===k));
 if(['auto','light','dark'].includes(c.theme))state.theme=c.theme;
 if(Number.isFinite(c.nameWidth))state.nameWidth=Math.min(400,Math.max(140,c.nameWidth));
 $('search').value=c.search||'';$('clear-search').hidden=!$('search').value;
 if(['exact','loose','typo'].includes(c.searchMode))$('search-mode').value=c.searchMode;
 if(['all','any'].includes(c.condition))$('search-condition').value=c.condition;
 if(['title','content','all'].includes(c.scope))$('search-scope').value=c.scope;
 if(statSpecs[c.stat])$('stats-source').value=c.stat;
 }catch{}};
const syncConfig=()=>{
 $('sort-key').value=state.sortKey;$('sort-direction').value=state.sortDirection;$('sort-group').checked=state.sortGroup;
 $('fields-panel').innerHTML=['project','task','note'].map(kind=>`<section><h3>${label[kind]}</h3><span class="fixed-field">标题 · 始终显示</span>${fieldOptions[kind].map(([key,name])=>`<label class="check-label"><input type="checkbox" data-field-kind="${kind}" data-field-key="${key}" ${state.fields[kind].includes(key)?'checked':''}>${name}</label>`).join('')}</section>`).join('');
 $('fields-panel').querySelectorAll('[data-field-kind]').forEach(b=>b.onchange=()=>{const keys=state.fields[b.dataset.fieldKind],key=b.dataset.fieldKey;if(b.checked&&!keys.includes(key))keys.push(key);else if(!b.checked)state.fields[b.dataset.fieldKind]=keys.filter(k=>k!==key);saveSettings();renderCalendar();});
};
const settingsTabs=[['gantt-locate-toggle','gantt-locate-panel'],['sort-toggle','sort-panel'],['fields-toggle','fields-panel']];
let activeSettingsTab=0;
const closeConfigPanels=()=>{$('view-settings-panel').hidden=true;$('view-settings-toggle').setAttribute('aria-expanded','false');settingsTabs.forEach(([,panel])=>$(panel).hidden=true);};
const openSettingsTab=(index,focusTab=false)=>{
 activeSettingsTab=index;$('view-settings-panel').hidden=false;$('view-settings-toggle').setAttribute('aria-expanded','true');
 settingsTabs.forEach(([button,panel],i)=>{$(panel).hidden=i!==index;$(button).setAttribute('aria-selected',String(i===index));$(button).tabIndex=i===index?0:-1;});
 if(focusTab)$(settingsTabs[index][0]).focus();
};
const bindConfig=()=>{
 $('view-settings-toggle').onclick=()=>{if($('view-settings-panel').hidden)openSettingsTab(activeSettingsTab);else closeConfigPanels();};
 settingsTabs.forEach(([button],i)=>{
  $(button).onclick=()=>openSettingsTab(i);
  $(button).onkeydown=e=>{let next;if(e.key==='ArrowRight')next=(i+1)%3;else if(e.key==='ArrowLeft')next=(i+2)%3;else if(e.key==='Home')next=0;else if(e.key==='End')next=2;if(next!==undefined){e.preventDefault();e.stopPropagation();openSettingsTab(next,true);}};
 });
 $('sort-key').onchange=()=>{state.sortKey=$('sort-key').value;renderAll();};
 $('sort-direction').onchange=()=>{state.sortDirection=$('sort-direction').value;renderAll();};
 $('sort-group').onchange=()=>{state.sortGroup=$('sort-group').checked;renderAll();};
 let feedbackTimer;
 const locateDate=d=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||Number.isNaN(parse(d).getTime())||iso(parse(d))!==d)return;
  state.anchor=parse(d);state.selectedDate=d;state.history=[];state.side={type:'date',date:d};renderAll();calendarFocus(d);openSettingsTab(0);
  const n=dateRows(d).length;
  clearTimeout(feedbackTimer);$('locate-feedback').textContent=n?'已定位 · '+fmt(n)+'项':'已定位 · 无匹配事项';
  feedbackTimer=setTimeout(()=>{$('locate-feedback').textContent='';},4000);
 };
 $('gantt-locate').onchange=()=>locateDate($('gantt-locate').value);
 $('locate-snapshot').onclick=()=>locateDate(meta.snapshot_date);
 $('locate-hint').textContent='数据快照：'+meta.snapshot_date+'；日历“今天”指系统日期。';
};

const byUrl=new Map(),adj=new Map();
const rebuildRelations=()=>{byUrl.clear();adj.clear();data.forEach(r=>{byUrl.set(r.url,r);adj.set(r.url,new Set());});data.forEach(r=>[...r.projects,...r.related].forEach(u=>connect(r.url,u)));};
const connect=(a,b)=>{if(a!==b&&adj.has(a)&&adj.has(b)){adj.get(a).add(b);adj.get(b).add(a);}};
rebuildRelations();
const names=urls=>urls.map(u=>byUrl.get(u)?.title||'未载入的关联记录');
const text=v=>v===null||v===undefined||v===''?'未设置':v;
const field=(k,v,long=false)=>`<div class="field"><div class="field-key">${esc(k)}</div><div class="field-value ${long?'long':''}">${esc(text(v))}</div></div>`;
const period=()=>{
 const y=state.anchor.getUTCFullYear(),m=state.anchor.getUTCMonth();
 if(state.mode==='week'){const lo=add(state.anchor,-((state.anchor.getUTCDay()+6)%7));return [iso(lo),iso(add(lo,6))];}
 if(state.mode==='month')return [iso(first(y,m)),iso(last(y,m))];
 if(state.mode==='quarter'){const q=Math.floor(m/3)*3;return [iso(first(y,q)),iso(last(y,q+2))];}
 return [iso(first(y,0)),iso(last(y,11))];
};
const periodName=()=>{const [lo,hi]=period(),y=state.anchor.getUTCFullYear(),m=state.anchor.getUTCMonth();return state.mode==='week'?`${isoWeek(lo).year}年第${isoWeek(lo).week}周`:state.mode==='month'?`${y}年${m+1}月`:state.mode==='quarter'?`${y}年 · Q${Math.floor(m/3)+1}`:`${y}年`;};
const displayRange=r=>{
 if(r.kind==='note')return [r.start_date,r.start_date];
 const start=r.start_date||r.due_date,end=r.due_date||r.start_date;
 if(state.dateMode==='start')return [r.start_date,r.start_date];
 if(state.dateMode==='due')return [r.due_date,r.due_date];
 if(r.invalid_range)return [end,end];
 return [start,end];
};
const inPeriod=(r,lo,hi)=>{const [start,end]=displayRange(r);return !!(start&&end&&start<=hi&&end>=lo);};
const normalizeSearch=v=>String(v??'').normalize('NFKC').toLowerCase().replace(/\s+/gu,' ').trim();
function parseSearch(v){const out=[],re=/"([^"]*)"|“([^”]*)”|([^\s,，;；|、"]+)/gu;let m;while((m=re.exec(String(v||'')))){const literal=m[1]!==undefined||m[2]!==undefined,txt=normalizeSearch(m[1]??m[2]??m[3]);if(txt)out.push({text:txt,literal})}return out}
function editWithin(a,b,max){if(Math.abs(a.length-b.length)>max)return false;let prev=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const cur=[i];let low=i;for(let j=1;j<=b.length;j++){cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));low=Math.min(low,cur[j])}if(low>max)return false;prev=cur}return prev[b.length]<=max}
function fieldMatch(field,q,mode){if(field.includes(q.text))return 'exact';if(q.literal||mode==='exact')return null;const txt=q.text;if(mode==='loose'){if(txt.length<2)return null;for(let start=0;start<field.length;start++){if(field[start]!==txt[0])continue;let k=1,lastPos=start;for(let j=start+1;j<Math.min(field.length,start+txt.length*2+3)&&k<txt.length;j++)if(field[j]===txt[k]){k++;lastPos=j}if(k===txt.length&&lastPos-start<txt.length*2+2)return 'loose'}return null}if(mode!=='typo'||txt.length<3)return null;const max=txt.length<=7?1:Math.min(2,Math.floor(txt.length*.2)),limit=Math.min(field.length,600);for(let i=0;i<limit;i++)for(let len=Math.max(1,txt.length-max);len<=txt.length+max&&i+len<=limit;len++)if(editWithin(field.slice(i,i+len),txt,max))return 'near';return null}
const buildSearchFields=()=>new Map(data.map(r=>[r.url,[
 ['title','名称',r.title],['description','描述',r.description],['remark','备注',r.remark],['summary','摘要',r.summary],
 ['people','人员安排',r.people.join('、')],['category','类别',r.category],['requester','需求人',r.requester],
 ['status','状态',r.status],['priority','优先级',r.priority],['date','日期',[r.start_date,r.due_date].filter(Boolean).join(' ')],
 ['projects','关联项目',names(r.effective_projects).join('、')]
].filter(x=>x[2]).map(([key,name,raw])=>({key,name,raw,text:normalizeSearch(raw)}))]));
let searchFields=buildSearchFields();
const searchDefaults={mode:'loose',condition:'all',scope:'title'};
let searchMeta=new Map(),searchQueries=[];
const refreshSearch=()=>{
 searchQueries=parseSearch($('search').value);searchMeta=new Map();
 const mode=$('search-mode').value,condition=$('search-condition').value,scope=$('search-scope').value;
 if(!searchQueries.length)return;
 for(const r of data){
  const fields=searchFields.get(r.url).filter(f=>scope==='all'||scope==='content'&&['title','description','remark','summary'].includes(f.key)||scope==='title'&&f.key==='title');
  const hits=[];for(const query of searchQueries){let best=null;for(const f of fields){const kind=fieldMatch(f.text,query,mode);if(!kind)continue;const score=(kind==='exact'?100:kind==='loose'?45:20)+(f.key==='title'?30:0);if(!best||score>best.score)best={...f,kind,score,query:query.text};}if(best)hits.push(best);}
  if(!hits.length||condition==='all'&&hits.length!==searchQueries.length)continue;
  const kind=hits.some(h=>h.kind==='near')?'near':hits.some(h=>h.kind==='loose')?'loose':'exact';
  searchMeta.set(r.url,{kind,hits,score:hits.reduce((s,h)=>s+h.score,0)});
 }
};
const matches=r=>(state.nodeFilter==='all'||r.kind===state.nodeFilter)&&(!['project','task'].includes(r.kind)||state.statusFilter==='all'||r.status===state.statusFilter)&&(!searchQueries.length||searchMeta.has(r.url));
const dateIndexes={start:new Map(),due:new Map(),continuous:new Map()};
const rebuildDates=()=>{Object.values(dateIndexes).forEach(index=>index.clear());
 const previous=state.dateMode;
 for(const mode of ['start','due']){state.dateMode=mode;for(const r of data){const [lo]=displayRange(r);if(!lo)continue;if(!dateIndexes[mode].has(lo))dateIndexes[mode].set(lo,[]);dateIndexes[mode].get(lo).push(r);}}
 state.dateMode=previous;
};rebuildDates();
const periodRows=()=>{const [lo,hi]=period();return data.filter(r=>matches(r)&&inPeriod(r,lo,hi));};
const dateRows=(d,metric='calendar')=>(state.dateMode==='continuous'?data.filter(r=>{const [lo,hi]=displayRange(r);return lo&&hi&&lo<=d&&hi>=d;}):(dateIndexes[state.dateMode].get(d)||[])).filter(r=>matches(r)&&(['calendar','events'].includes(metric)||r.kind===metric));
const heatLevel=n=>n===0?0:n===1?1:n===2?2:n<5?3:4;
const statusRank={'进行中':0,'未开始':1,'已归档':2};
const duration=r=>r.kind==='note'?0:r.start_date&&r.due_date&&!r.invalid_range?Math.round((parse(r.due_date)-parse(r.start_date))/86400000)+1:null;
const sortValue=r=>state.sortKey==='start'?r.start_date:state.sortKey==='due'?(r.kind==='note'?r.start_date:r.due_date):state.sortKey==='duration'?duration(r):state.sortKey==='status'?(r.kind==='note'?3:statusRank[r.status]??4):state.sortKey==='priority'?({高:0,中:1,低:2}[r.priority]??null):r.title;
const sortRows=rows=>[...rows].sort((a,b)=>{
 const group=state.sortGroup?({project:0,task:1,note:2}[a.kind]-{project:0,task:1,note:2}[b.kind]):0;if(group)return group;
 const av=sortValue(a),bv=sortValue(b),am=av===null||av===undefined||av==='',bm=bv===null||bv===undefined||bv==='';if(am!==bm)return am?1:-1;
 const cmp=am?0:typeof av==='number'?av-bv:String(av).localeCompare(String(bv),'zh');
 return (state.sortDirection==='desc'?-cmp:cmp)||a.title.localeCompare(b.title,'zh');
});
const overdue=r=>r.kind==='task'&&r.status!=='已归档'&&r.due_date&&r.due_date<meta.snapshot_date;
const remaining=r=>!r.due_date?'未设置':r.status==='已归档'?'已归档':(()=>{const n=Math.round((parse(r.due_date)-parse(meta.snapshot_date))/86400000);return n===0?'快照当天到期':n>0?'剩余 '+fmt(n)+' 天':'逾期 '+fmt(-n)+' 天';})();
const metricTitle=(kind)=>kind==='note'?'创建笔记':({start:'开始',due:'到期',continuous:'覆盖'}[state.dateMode])+label[kind];
const dateNavLabel=d=>{const n=dateRows(d).length;return `${d}，${fmt(n)}项`;};
const dateButton=(d,display,cls='date-button')=>`<button type="button" class="${cls} ${state.selectedDate===d?'selected-date':''}" data-day="${d}" tabindex="${state.selectedDate===d?'0':'-1'}" aria-pressed="${state.selectedDate===d}" aria-label="${esc(dateNavLabel(d))}">${display}</button>`;
const goSide=(next,push=true)=>{
 if(push&&state.side)state.history.push(state.side);
 state.side=next;renderSidebar();renderCalendar();
 if(innerWidth<=680)$('side').scrollIntoView({behavior:'auto',block:'start'});
};
const selectDay=d=>{state.selectedDate=d;state.history=[];goSide({type:'date',date:d},false);};
const selectRecord=u=>{if(byUrl.has(u))goSide({type:'record',url:u});};
const relButton=r=>`<button class="rel" type="button" data-open="${esc(r.url)}"><span class="dot ${r.kind}-dot"></span><span class="rel-body">${esc(r.title)}</span></button>`;
const grouped=(rows,projectContext='')=>['project','task','note'].map(kind=>{
 const list=sortRows(rows.filter(r=>r.kind===kind));
 return list.length?`<h3>${label[kind]} · ${fmt(list.length)}</h3>${list.map(r=>relButton(r,r.kind==='project'?projectContext:'' )).join('')}`:'';
}).join('');
let renderedSideKey=null;
const renderSidebar=()=>{
 const side=state.side;
 const sideKey=side?JSON.stringify([side.type,side.url||side.date||side.title||'']):'';
 const sidebarScroll=sideKey===renderedSideKey?$('side').scrollTop:0;
 renderedSideKey=sideKey;$('side').scrollTop=sidebarScroll;
 $('side-back').disabled=!state.history.length;
 $('side-crumb').textContent=[...state.history.slice(-2),side].filter(Boolean).map(x=>x.type==='date'?x.date:x.type==='record'?byUrl.get(x.url)?.title:x.type==='category'?x.title:'搜索结果').join(' › ');
 if(!side){$('side-content').innerHTML='<div class="side-empty"><strong>选择一个日期或事项</strong>查看当天全部内容，再逐层浏览关联记录。</div>';$('side-crumb').textContent='';return;}
 let html='';
 if(side.type==='date'){
  const rows=dateRows(side.date);
  html=`<div class="eyebrow">当天事项</div><h2>${side.date}</h2><div class="source-summary">${['project','task','note'].map(k=>`<span class="badge">${label[k]} ${fmt(rows.filter(r=>r.kind===k).length)}</span>`).join('')}</div>${rows.length?grouped(rows,state.dateMode==='continuous'?'计划覆盖':''):'<div class="side-empty">当天没有匹配事项。</div>'}<button id="open-month" class="date-view-month" type="button">进入 ${parse(side.date).getUTCMonth()+1} 月视图 →</button>`;
 }else if(side.type==='category'){
 const rows=(side.rows||[]).map(u=>byUrl.get(u)).filter(Boolean);html=`<div class="eyebrow">分类记录</div><h2>${esc(side.title)}</h2><div class="search-result-mark">${fmt(rows.length)}项</div>${grouped(rows)}`;
 }else if(side.type==='search'){
  const rows=periodRows();html=`<div class="eyebrow">当前周期内搜索</div><h2>搜索结果</h2><div class="search-result-mark">${fmt(rows.length)} 条匹配记录 · ${esc($('search').value)}</div>${rows.length?grouped(rows):'<div class="side-empty">没有匹配结果。可调整周期或搜索范围。</div>'}`;
 }else{
  const r=byUrl.get(side.url);
  if(!r){$('side-content').innerHTML='<div class="side-empty">记录未载入。</div>';return;}
  const rs=[...adj.get(r.url)].map(u=>byUrl.get(u)),badges=[r.category];
  if(r.kind!=='note'){badges.push(r.status||'未设置状态','优先级：'+(r.priority||'未设置'));}
  html=`<div class="eyebrow">${label[r.kind]}数据库</div><h2>${esc(r.title)}</h2><div class="badges">${badges.filter(Boolean).map(t=>`<span class="badge">${esc(t)}</span>`).join('')}</div><h3>记录信息</h3>`;
  if(r.kind==='task'){
   html+=field('人员安排',r.people.join('、'))+field('需求人',r.requester)+field('任务描述',r.description,true)+field('备注',r.remark,true)+field('开始日期',r.start_date)+field('截止日期',r.due_date)+field('剩余天数',remaining(r))+(r.invalid_range?field('日期提醒','开始日期晚于截止日期；按原始截止节点展示'):'');
  }else if(r.kind==='project'){
   const tasks=rs.filter(x=>x.kind==='task'),done=tasks.filter(x=>x.status==='已归档').length;
   html+=field('项目描述',r.description,true)+field('开始日期',r.start_date)+field('截止日期',r.due_date)+field('备注',r.remark,true);
   if(tasks.length){const percent=done/tasks.length*100;html+=`<div class="field"><div class="field-key">关联任务归档率</div><div class="field-value">${InlineChartRuntime.formatValue(percent,'percent')}（${fmt(done)} / ${fmt(tasks.length)}）<div class="progress"><i style="width:${percent}%"></i></div></div></div>`;}else html+=field('任务进展','暂无关联任务');
  }else{
   html+=field('笔记类型',r.category)+field('创建日期',r.start_date)+field('笔记摘要',r.summary,true);
   if(r.inherited_projects.length)html+=`<h3>由任务推导的关联项目</h3>${r.inherited_projects.map(u=>byUrl.get(u)).filter(Boolean).map(r=>relButton(r,'间接关联')).join('')}`;
  }
  html+=`<a class="external-link" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">打开 Notion 页面 ↗</a><h3>直接关联 · ${fmt(rs.length)}</h3>${rs.length?grouped(rs):'<div class="side-note">暂无已载入的直接关联。</div>'}`;
 }
 $('side-content').innerHTML=html;
 $('side').scrollTop=sidebarScroll;
 $('side-content').querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>selectRecord(b.dataset.open));
 if($('open-month'))$('open-month').onclick=()=>{state.mode='month';state.anchor=parse(state.side.date);renderAll();};
};

const weekdays=['一','二','三','四','五','六','日'];
const monthDays=(y,m,fixed=true)=>{
 const start=first(y,m),offset=(start.getUTCDay()+6)%7,n=fixed?42:Math.ceil((offset+last(y,m).getUTCDate())/7)*7;
 return Array.from({length:n},(_,i)=>add(start,i-offset));
};
const weekRecordFields=r=>(state.fields[r.kind]||[]).map(key=>{
 const raw=fieldValue(r,key);if(!raw)return '';
 const names={start:r.kind==='note'?'创建':'开始',due:'截止',category:r.kind==='note'?'类型':'类别',priority:'优先级',projects:r.kind==='note'?'关联项目':'所属项目',related:'关联任务'};
 let value=String(raw);if(['start','due'].includes(key)&&/^\d{4}-\d{2}-\d{2}$/.test(value))value=value.slice(0,4)===String(state.anchor.getUTCFullYear())?value.slice(5).replace('-','/'):value.replaceAll('-','/');
 return `<span class="week-field"><span class="week-field-key">${esc(names[key]||key)}：</span><span class="week-field-value">${esc(value)}</span></span>`;
}).filter(Boolean).join('');
const renderWeek=()=>{
 const [lo]=period();return `<div class="week-grid">${Array.from({length:7},(_,i)=>{
 const d=iso(add(parse(lo),i)),rows=sortRows(dateRows(d));
 return `<div class="week-day"><div class="week-head">${dateButton(d,`${d.slice(5)} 周${weekdays[i]}`)}<span>${fmt(rows.length)} 项</span></div>${rows.length?rows.map(r=>`<button class="week-event ${r.kind}" type="button" data-record="${esc(r.url)}" data-anchor="${d}"><span>${esc(r.title)}</span><small class="week-card-fields">${weekRecordFields(r)}</small></button>`).join(''):'<div class="week-empty">暂无事项</div>'}</div>`;
 }).join('')}</div>`;
};
const packWeek=(lo)=>{
 const hi=iso(add(parse(lo),6)),records=sortRows(data.filter(r=>matches(r)&&inPeriod(r,lo,hi))),lanes=[],segments=[];
 for(const r of records){
  const [rawStart,rawEnd]=displayRange(r),start=rawStart<lo?lo:rawStart,end=rawEnd>hi?hi:rawEnd;
  const from=Math.round((parse(start)-parse(lo))/86400000),to=Math.round((parse(end)-parse(lo))/86400000);
  let lane=0;while(lanes[lane]?.some(x=>x.from<=to&&x.to>=from))lane++;
  if(!lanes[lane])lanes[lane]=[];const seg={r,from,to,start,end,lane,continuedLeft:rawStart<lo,continuedRight:rawEnd>hi};lanes[lane].push(seg);segments.push(seg);
 }
 return {segments,lanes};
};
const renderSpanWeek=(lo,fixed)=>{
 const {segments,lanes}=packWeek(lo),max=fixed?3:lanes.length;
 const headers=Array.from({length:7},(_,i)=>{const d=iso(add(parse(lo),i));return `<div class="span-day-head ${state.selectedDate===d?'selected':''}">${dateButton(d,fixed?parse(d).getUTCDate():`${d.slice(5)} 周${weekdays[i]}`)}</div>`;}).join('');
 const bars=segments.filter(s=>s.lane<max).map(s=>`<button type="button" class="range-bar ${s.r.kind} ${fixed?'compact':'full'}" data-record="${esc(s.r.url)}" data-anchor="${s.start}" title="${esc(s.r.title)}" style="grid-column:${s.from+1}/span ${s.to-s.from+1};grid-row:${s.lane+1}">${s.continuedLeft?'‹ ':''}${esc(s.r.title)}${s.continuedRight?' ›':''}${!fixed?`<small>${label[s.r.kind]}${s.r.status?' · '+esc(s.r.status):''}${s.r.kind!=='note'?'<br>'+esc(s.r.start_date||'—')+' → '+esc(s.r.due_date||'—'):''}</small>`:''}</button>`).join('');
 const more=fixed?`<div class="span-more">${Array.from({length:7},(_,i)=>{const hidden=segments.filter(s=>s.lane>=max&&s.from<=i&&s.to>=i).length,d=iso(add(parse(lo),i));return hidden?`<button type="button" class="more" data-day="${d}">+${fmt(hidden)}项</button>`:'<span></span>';}).join('')}</div>`:'';
 return `<div class="span-week ${fixed?'fixed':'unbounded'}"><div class="span-headers">${headers}</div><div class="span-lanes" style="${fixed?'grid-template-rows:repeat(3,24px)':'grid-template-rows:repeat('+Math.max(1,lanes.length)+',auto)'}">${bars}</div>${more}</div>`;
};
const renderContinuousWeek=()=>{
 const [lo]=period();
 return `<div class="continuous-desktop">${renderSpanWeek(lo,false)}</div><div class="continuous-mobile">${renderWeek()}</div>`;
};
const renderMonth=()=>{
 const y=state.anchor.getUTCFullYear(),m=state.anchor.getUTCMonth(),days=monthDays(y,m);
 return `<div class="month-weekhead"><span>周</span><div class="weekdays">${weekdays.map(w=>`<span>${w}</span>`).join('')}</div></div><div class="month-spans">${Array.from({length:6},(_,i)=>`<div class="month-weekrow"><span class="weeknum" title="${isoWeek(iso(days[i*7])).year}年第${isoWeek(iso(days[i*7])).week}周">W${isoWeek(iso(days[i*7])).week}</span>${renderSpanWeek(iso(days[i*7]),true)}</div>`).join('')}</div>`;
};
const heatTitle=(day,rows)=>`${day} · ${fmt(rows.length)}项\n`+['project','task','note'].map(k=>`${label[k]} ${fmt(rows.filter(r=>r.kind===k).length)}`).join(' / ');
const heatCell=(d,mobile=false)=>{
 const rows=dateRows(d),level=heatLevel(rows.length);
 return `<button type="button" class="heat-cell ${state.selectedDate===d?'selected':''}" data-day="${d}" tabindex="${state.selectedDate===d?'0':'-1'}" aria-pressed="${state.selectedDate===d}" data-level="${level}" title="${esc(heatTitle(d,rows))}" aria-label="${esc(heatTitle(d,rows))}">${mobile?parse(d).getUTCDate():''}</button>`;
};
const renderHeat=()=>{
 const [lo,hi]=period(),start=add(parse(lo),-((parse(lo).getUTCDay()+6)%7)),end=add(parse(hi),6-((parse(hi).getUTCDay()+6)%7));
 const n=Math.round((end-start)/86400000)+1,weeks=n/7,days=Array.from({length:n},(_,i)=>iso(add(start,i)));
 const cells=days.map(d=>d<lo||d>hi?'<span class="heat-cell heat-blank"></span>':heatCell(d)).join('');
 const marks=[];let prevMonth=-1;
 for(let col=0;col<weeks;col++){const dates=days.slice(col*7,col*7+7).filter(d=>d>=lo&&d<=hi);if(dates.length){const month=parse(dates[0]).getUTCMonth();if(month!==prevMonth){marks.push(`<span style="grid-column:${col+1}/span ${Math.min(4,weeks-col)}">${month+1}月</span>`);prevMonth=month;}}}
 const desktop=`<div class="heat-desktop"><div class="heat-body"><div class="heat-months" style="grid-template-columns:repeat(${weeks},minmax(0,1fr))">${marks.join('')}</div><div class="heat-labels">${weekdays.map(w=>`<span>${w}</span>`).join('')}</div><div class="heat-weeks" style="grid-template-columns:repeat(${weeks},minmax(0,1fr))">${cells}</div></div></div>`;
 const y=state.anchor.getUTCFullYear(),begin=state.mode==='quarter'?Math.floor(state.anchor.getUTCMonth()/3)*3:0,num=state.mode==='quarter'?3:12;
 const mobile=`<div class="heat-mobile"><div class="mobile-heat-months">${Array.from({length:num},(_,i)=>{
 const m=begin+i;return `<section class="mobile-heat-month"><h3>${m+1}月</h3><div class="weekdays">${weekdays.map(w=>`<span>${w}</span>`).join('')}</div><div class="mobile-heat-grid">${monthDays(y,m,false).map(d=>d.getUTCMonth()!==m?'<span></span>':heatCell(iso(d),true)).join('')}</div></section>`;
 }).join('')}</div></div>`;
 let total=0,active=0;for(let d=lo;d<=hi;d=iso(add(parse(d),1))){const n=dateRows(d).length;total+=n;if(n)active++;}
 return desktop+mobile+`<div class="heat-caption"><span title="当前周期内至少有一条匹配日期记录的天数">有记录天数 ${fmt(active)}</span><span title="按当前日期口径与顶部筛选计数；不是完成量，也不是持续天数">日期记录数 ${fmt(total)}</span></div>`;
};
const calendarFocus=(d)=>{
 const nodes=[...$('calendar').querySelectorAll('[data-day]')];
 const target=nodes.find(b=>b.dataset.day===d&&b.getClientRects().length);
 target?.focus({preventScroll:true});if(state.dateMode==='continuous'&&target){const sc=target.closest('.gantt-scroll'),t=target.getBoundingClientRect(),box=sc.getBoundingClientRect(),nw=sc.querySelector('.gantt-name').getBoundingClientRect().width;if(t.left<box.left+nw||t.right>box.right-15)sc.scrollLeft+=t.left-box.left-nw-(sc.clientWidth-nw)/2+t.width/2;}
};
const renderGantt=()=>{
 const [lo,hi]=period(),n=Math.round((parse(hi)-parse(lo))/86400000)+1,rows=sortRows(periodRows()),days=Array.from({length:n},(_,i)=>iso(add(parse(lo),i)));
 const available=Math.max(160,$('calendar').clientWidth-(innerWidth<680?150:state.nameWidth)-2),dayWidth=Math.max({week:64,month:25,quarter:14,year:12}[state.mode],available/n),timelineWidth=Math.round(n*dayWidth);
 const bands=[],addBand=(title,from,to)=>bands.push(`<span style="left:${from*dayWidth}px;width:${(to-from+1)*dayWidth}px">${esc(title)}</span>`);
 let bandStart=0,bandKey='';days.forEach((d,i)=>{const w=isoWeek(d),key=state.mode==='week'||state.mode==='month'?`${w.year}-W${w.week}`:d.slice(0,7);if(i&&key!==bandKey){addBand(bandKey,bandStart,i-1);bandStart=i;}bandKey=key;});addBand(bandKey,bandStart,n-1);
 const weekBands=[];let ws=0,wkey='';days.forEach((d,i)=>{const w=isoWeek(d),key='W'+w.week;if(i&&key!==wkey){weekBands.push(`<span style="left:${ws*dayWidth}px;width:${(i-ws)*dayWidth}px">${wkey}</span>`);ws=i;}wkey=key;});weekBands.push(`<span style="left:${ws*dayWidth}px;width:${(n-ws)*dayWidth}px">${wkey}</span>`);
 const showWeekBands=['quarter','year'].includes(state.mode);
 const selected=Math.round((parse(state.selectedDate||lo)-parse(lo))/86400000),stripe=selected>=0&&selected<n?`<i class="gantt-selected-column" style="left:${selected*dayWidth}px;width:${dayWidth}px"></i>`:'';
 const headers=days.map((d,i)=>`<button type="button" class="gantt-tick ${state.selectedDate===d?'selected-date':''} ${[0,6].includes(parse(d).getUTCDay())?'weekend':''}" style="width:${dayWidth}px" data-day="${d}" aria-label="${esc(dateNavLabel(d))}" title="${esc(dateNavLabel(d))}" tabindex="${state.selectedDate===d?'0':'-1'}" aria-pressed="${state.selectedDate===d}">${state.mode==='week'?d.slice(5)+'<small>周'+weekdays[i]+'</small>':state.mode==='month'?parse(d).getUTCDate():'<span class="tick-mark">·</span>'}</button>`).join('');
 let prevKind='',content='';
 for(const r of rows){
  if(state.sortGroup&&r.kind!==prevKind){content+=`<div class="gantt-row gantt-group"><div class="gantt-name">${label[r.kind]} · ${rows.filter(x=>x.kind===r.kind).length}</div><div class="gantt-group-track"></div></div>`;prevKind=r.kind;}
  const [start,end]=displayRange(r),from=Math.max(0,Math.round((parse(start)-parse(lo))/86400000)),to=Math.min(n-1,Math.round((parse(end)-parse(lo))/86400000));
  const single=r.kind==='note'||!r.start_date||!r.due_date||r.invalid_range,fields=recordFields(r),left=from*dayWidth,width=Math.max(6,(to-from+1)*dayWidth-4),details=single?r.invalid_range?'日期异常':r.kind==='note'?'创建日期':'单日节点':start+' → '+end;
  const mark=single?`<button class="gantt-point ${r.kind} ${r.invalid_range?'invalid':''}" type="button" style="left:${left+dayWidth/2}px" data-record="${esc(r.url)}" data-anchor="${start<lo?lo:start}" title="${esc(r.title+' · '+details)}" aria-label="${esc(r.title+' · '+details)}"></button>`:`<button class="gantt-bar ${r.kind} ${r.status==='已归档'?'archived':r.status==='未开始'?'planned':''}" type="button" style="left:${left+2}px;width:${width}px" data-record="${esc(r.url)}" data-anchor="${start<lo?lo:start}" title="${esc(r.title+' · '+details)}" aria-label="${esc(r.title+' · '+details)}">${start<lo?'<span class="continuation left">‹</span>':''}${end>hi?'<span class="continuation right">›</span>':''}</button>`;
  content+=`<div class="gantt-row" data-row="${esc(r.url)}"><button type="button" class="gantt-name gantt-name-record" data-record="${esc(r.url)}" data-anchor="${start<lo?lo:start}" title="${esc(r.title)}"><span class="gantt-record-title"><i class="dot ${r.kind}-dot"></i><span>${esc(r.title)}</span></span>${fields?`<small class="gantt-record-fields">${fields}</small>`:''}</button><div class="gantt-track">${stripe}${mark}</div></div>`;
 }
 return `<div class="gantt-scroll ${state.mode==='week'?'week-full':''}" tabindex="-1"><div class="gantt-table" style="--name-width:${innerWidth<680?150:state.nameWidth}px;--timeline-width:${timelineWidth}px;--day-width:${dayWidth}px"><div class="gantt-header gantt-row ${showWeekBands?'has-weekbands':''}"><div class="gantt-name header-name">事项 <small>${rows.length}项</small><button type="button" id="name-resize" class="name-resize" role="separator" aria-orientation="vertical" aria-label="调整名称列宽度" aria-valuemin="140" aria-valuemax="400" aria-valuenow="${state.nameWidth}" title="拖动调整名称列宽度"></button></div><div class="gantt-header-track"><div class="gantt-bands">${bands.join('')}</div>${showWeekBands?`<div class="gantt-bands gantt-weekbands">${weekBands.join('')}</div>`:''}<div class="gantt-dates">${headers}</div></div></div>${content||'<div class="gantt-row"><div class="gantt-name">暂无匹配事项</div><div class="gantt-track"></div></div>'}</div></div>`;
};
const bindNameResize=()=>{
 const b=$('name-resize');if(!b)return;let startX=0,startWidth=0,dragging=false;
 const update=w=>{state.nameWidth=Math.min(400,Math.max(140,w));$('calendar').querySelector('.gantt-table').style.setProperty('--name-width',state.nameWidth+'px');b.setAttribute('aria-valuenow',String(Math.round(state.nameWidth)));};
 b.onpointerdown=e=>{startX=e.clientX;startWidth=state.nameWidth;dragging=true;b.setPointerCapture(e.pointerId);e.preventDefault();};b.onpointermove=e=>{if(dragging)update(startWidth+e.clientX-startX);};
 b.onpointerup=()=>{dragging=false;saveSettings();};b.onpointercancel=()=>dragging=false;
 b.onkeydown=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();e.stopPropagation();update(state.nameWidth+(e.key==='ArrowRight'?16:-16));saveSettings();}};
};

const renderCalendar=()=>{
 $('locate-feedback').textContent='';
 const oldScroll=$('calendar').querySelector('.gantt-scroll'),oldX=oldScroll?.scrollLeft||0,oldY=oldScroll?.scrollTop||0;
 $('heat-description').textContent=state.dateMode==='start'?'按开始／创建日期统计':'按截止／创建日期统计';
 $('heat-options').hidden=state.dateMode==='continuous'||!['year','quarter'].includes(state.mode);
 $('gantt-locate').value=state.selectedDate||period()[0];
 $('calendar').innerHTML=state.dateMode==='continuous'?renderGantt():state.mode==='week'?renderWeek():state.mode==='month'?renderMonth():renderHeat();
 const sc=$('calendar').querySelector('.gantt-scroll');if(sc){sc.scrollLeft=oldX;sc.scrollTop=oldY;}
 bindNameResize();
 if(!periodRows().length){
  const filtered=state.nodeFilter!=='all'||state.statusFilter!=='all';
  $('calendar').insertAdjacentHTML('beforeend',`<div class="calendar-no-result">当前周期无匹配记录 · ${esc(filterDescription())}${filtered?'<button type="button" id="restore-match">恢复全部筛选</button>':''}${$('search').value?'<span class="empty-search-hint">搜索条件已保留，可通过搜索框清空。</span>':''}</div>`);
 }
 if($('restore-match'))$('restore-match').onclick=restoreNodeFilters;
 $('calendar').querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>{selectDay(b.dataset.day);calendarFocus(b.dataset.day);});
 $('calendar').querySelectorAll('[data-record]').forEach(b=>b.onclick=()=>{state.selectedDate=b.dataset.anchor||state.selectedDate;selectRecord(b.dataset.record);});
};
const dimensions={
 note:[['category','笔记类型'],['projects','关联项目'],['related','关联任务'],['time','时间分布']],
 task:[['category','任务类别'],['status','当前状态'],['priority','优先级'],['projects','关联项目'],['time','时间分布']],
 project:[['category','项目类别'],['status','当前状态'],['priority','优先级'],['time','时间分布']]
};
const refreshDimensions=()=>{
 const source=statSpec().kind,old=$('stats-dimension').value,options=dimensions[source];
 $('stats-dimension').innerHTML=options.map(([v,t])=>`<option value="${v}">${t}</option>`).join('');
 $('stats-dimension').value=options.some(([v])=>v===old)?old:'category';
 refreshChartOptions();
};
const refreshChartOptions=()=>{
 const time=$('stats-dimension').value==='time',multiple=['projects','related'].includes($('stats-dimension').value),old=$('stats-shape').value;
 const choices=time?[['line','折线图'],['vertical','纵向柱形图']]:multiple?[['horizontal','横向柱形图'],['vertical','纵向柱形图']]:[['horizontal','横向柱形图'],['vertical','纵向柱形图'],['ring','环形图']];
 $('stats-shape').innerHTML=choices.map(([v,t])=>`<option value="${v}">${t}</option>`).join('');
 $('stats-shape').value=choices.some(([v])=>v===old)?old:time?'line':statSpec().kind==='note'&&$('stats-dimension').value==='category'?'ring':'horizontal';
};
const dimensionKeys=(r,dim)=>{
 if(dim==='projects')return r.effective_projects.length?[...new Set(names(r.effective_projects))]:['未关联项目'];
 if(dim==='related'){const urls=r.related.filter(u=>byUrl.get(u)?.kind==='task');return urls.length?[...new Set(names(urls))]:['未关联任务'];}
 return [r[dim]||'未设置'];
};
const dimensionKey=(r,dim)=>dimensionKeys(r,dim)[0];
const colorTokens=['--blue','--yellow','--green','--purple','--orange','--pink','--teal','--red'];
const categoryColor=k=>{
 if(k==='其他')return InlineChartRuntime.cssVar('--neutral')||'#a39e98';
 let hash=0;for(const ch of k)hash=(hash*31+ch.codePointAt(0))>>>0;
 const token=colorTokens[hash%colorTokens.length];
 return InlineChartRuntime.cssVar(token)||'#7fb4ec';
};
const timeBuckets=source=>{
 const [lo,hi]=period(),rows=statRows(),buckets=[];
 if(['week','month'].includes(state.mode)){for(let d=lo;d<=hi;d=iso(add(parse(d),1)))buckets.push({key:d,lo:d,hi:d,label:d.slice(5)});}
 else{const a=parse(lo),b=parse(hi);for(let m=a.getUTCMonth();m<=b.getUTCMonth();m++)buckets.push({key:`${a.getUTCFullYear()}-${String(m+1).padStart(2,'0')}`,lo:iso(first(a.getUTCFullYear(),m)),hi:iso(last(a.getUTCFullYear(),m)),label:`${m+1}月`});}
 return buckets.map(b=>({...b,rows:rows.filter(r=>{const d=statDate(r);return d&&d>=b.lo&&d<=b.hi;})}));
};
let chartInstance=initialChart,plottedState=[];
const renderStats=()=>{
 const source=statSpec().kind,dim=$('stats-dimension').value,shape=$('stats-shape').value,rows=statRows(),groups=new Map();
 const sourceName=statSpec().label,dimName=dimensions[source].find(([v])=>v===dim)[1],time=dim==='time';
 let plotted,allEntries;
 if(time){plotted=timeBuckets(source).map(b=>({key:b.key,label:b.label,value:b.rows.length,rows:b.rows}));allEntries=plotted;}
 else{
  rows.forEach(r=>dimensionKeys(r,dim).forEach(key=>{if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}));
  allEntries=[...groups].map(([key,rs])=>({key,label:key,value:rs.length,rows:rs})).sort((a,b)=>b.value-a.value||(a.key<b.key?-1:a.key>b.key?1:0));
  const max=shape==='ring'?6:7;plotted=allEntries.slice(0,max);
  if(allEntries.length>max)plotted.push({key:'其他',label:'其他',value:allEntries.slice(max).reduce((s,x)=>s+x.value,0),rows:[...new Map(allEntries.slice(max).flatMap(x=>x.rows).map(r=>[r.url,r])).values()]});
 }
 plottedState=plotted;
 const figure=$('distribution').closest('.chart-figure');figure.querySelectorAll('table.sr-only').forEach(t=>t.remove());
 figure.insertAdjacentHTML('beforeend',`<table class="sr-only"><caption>${esc(sourceName+' · '+dimName)}</caption><tr><th>类别</th><th>${esc(sourceName)}</th></tr>${plotted.map(p=>`<tr><td>${esc(p.key)}</td><td data-observation-key="${esc(p.label)}" data-series-key="${esc(sourceName)}" data-raw-value="${p.value}" data-value-kind="count">${fmt(p.value)}</td></tr>`).join('')}</table>`);
 $('stats-title').textContent=periodName()+sourceName+' · '+dimName;
 $('stats-aside').textContent=fmt(rows.length)+' 项'+sourceName;
 const dateBasis=source==='note'?'笔记创建日期':(source==='project'?'项目':'任务')+(statSpec().date==='due_date'?'截止日期':'开始日期');
 $('stats-context').textContent='周期与筛选同步，日期口径由统计对象决定。当前按'+dateBasis+'统计，不代表完成量。';
 const wrap=$('distribution').parentElement;
 $('chart-legend').innerHTML='';
 if (typeof Chart === "undefined") {wrap.hidden=true;$('chart-empty').hidden=false;$('chart-empty').textContent='Chart could not be rendered. 日历与侧栏仍可使用。';return;}
 if(!rows.length||plotted.length<2){wrap.hidden=true;$('chart-empty').hidden=false;$('chart-empty').textContent=rows.length?`${plotted[0].key}：${fmt(rows.length)}项`:'当前周期与搜索条件下暂无记录。';return;}
 wrap.hidden=false;$('chart-empty').hidden=true;
 const labels=plotted.map(x=>x.label),values=plotted.map(x=>x.value),css=k=>InlineChartRuntime.cssVar(k),range=InlineChartRuntime.axisRange(0,Math.max(...values),{zero:true,target:4});
 const horizontal=shape==='horizontal',ring=shape==='ring',line=shape==='line',type=ring?'doughnut':line?'line':'bar';
 const colors=plotted.map(p=>categoryColor(p.key));
 if(ring)$('chart-legend').innerHTML=plotted.map((p,i)=>`<button type="button" class="legend-category" data-category="${i}"><i style="background:${colors[i]}"></i>${esc(p.key)}</button>`).join('');
 $('chart-legend').querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>goSide({type:'category',index:Number(b.dataset.category),title:plotted[Number(b.dataset.category)].key,rows:plotted[Number(b.dataset.category)].rows.map(r=>r.url)}));
 const external=ctx=>{
  const tooltip=ctx.tooltip,tip=ctx.chart.canvas.parentElement.querySelector('.chart-tooltip');
  if(!tooltip||tooltip.opacity===0){tip.dataset.visible='false';tip.setAttribute('aria-hidden','true');return;}
  const i=tooltip.dataPoints[0].dataIndex,p=plotted[i];
  const info=[{color:ring?colors[i]:line?css('--purple'):colors[i],mark:line?'line':'square',label:sourceName,value:fmt(p.value)}];
  if(ring)info.push({extra:'占所选对象 '+InlineChartRuntime.formatValue(p.value/rows.length*100,'percent')});
  InlineChartRuntime.buildTooltip(tip,p.key,info);
  tip.dataset.visible='true';tip.setAttribute('aria-hidden','false');InlineChartRuntime.positionTooltip(tip,ctx.chart.canvas.parentElement,tooltip.caretX,tooltip.caretY);
 };
 const valueAxis=horizontal||ring?'x':'y';
 const ds={label:sourceName,valueKind:'count',data:values,backgroundColor:ring||!line?colors:css('--purple')+'22',borderColor:line?css('--purple'):undefined,borderWidth:line?2:0,borderRadius:ring?0:4,maxBarThickness:24,pointRadius:line?3:0,pointBackgroundColor:css('--purple'),fill:line,clip:8,tension:0};
 const valueScale={type:'linear',display:!ring,min:range.min,max:range.max,ticks:{stepSize:range.step,color:css('--muted'),maxTicksLimit:6,callback:v=>InlineChartRuntime.formatValue(v,'countCompact')},grid:{color:ctx=>ctx.tick.value===0?css('--border-strong'):css('--grid')}};
 const categoryScale={type:'category',display:!ring,grid:{display:false},ticks:{color:css('--muted'),autoSkip:time&&labels.length>12,maxRotation:horizontal?0:45,minRotation:0,font:{size:12},callback:function(v){const label=this.getLabelForValue(v);return [...label].length>12?[...label].slice(0,11).join('')+'…':label;}}};
 const scales=ring?{x:valueScale}:horizontal?{x:valueScale,y:categoryScale}:{x:categoryScale,y:valueScale};
 wrap.style.height=ring?'290px':horizontal?Math.max(240,plotted.length*34+40)+'px':'300px';
 $('distribution').setAttribute('aria-label',$('stats-title').textContent+'：'+plotted.map(p=>p.key+' '+fmt(p.value)+'项').join('；'));
 chartInstance?.destroy();
 const barValueLabels={id:'calendarBarValues',afterDatasetsDraw(chart){
  if(chart.config.type!=='bar')return;
  const ctx=chart.ctx,meta=chart.getDatasetMeta(0),tight=!horizontal&&chart.chartArea.width/labels.length<20;
  ctx.save();ctx.font='11px system-ui, sans-serif';ctx.fillStyle=css('--text')||getComputedStyle(document.documentElement).color;
  meta.data.forEach((bar,i)=>{const text=fmt(values[i]);ctx.save();
   if(horizontal){ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(text,bar.x+7,bar.y);}
   else if(tight){ctx.translate(bar.x,bar.y-6);ctx.rotate(-Math.PI/2);ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(text,0,0);}
   else{ctx.textAlign='center';ctx.textBaseline='bottom';ctx.fillText(text,bar.x,bar.y-6);}
   ctx.restore();
  });ctx.restore();
 }};
 const chart = new Chart($('distribution'),{
  type,data:{labels,datasets:[ds]},plugins:[barValueLabels,...(line?[InlineChartRuntime.chartJs.crosshair]:[]),InlineChartRuntime.chartJs.createAudit({valueAxis,valueKind:'count'})],
  options:{indexAxis:horizontal?'y':'x',responsive:true,maintainAspectRatio:false,animation:false,cutout:ring?'64%':undefined,layout:{padding:{left:0,right:!ring&&!line&&horizontal?40:0,top:!ring&&!line&&!horizontal?40:0,bottom:0}},plugins:{legend:{display:false},tooltip:{enabled:false,external}},scales,
   interaction:line?{mode:'index',intersect:false,axis:'x'}:undefined,
   onClick:(_,hits)=>{if(hits.length){const p=plotted[hits[0].index];goSide({type:'category',title:p.key,rows:p.rows.map(r=>r.url)});}}
  }
 });
 InlineChartRuntime.chartJs.stabilize(chart);
 chartInstance=chart;
 $('chart-data-summary').textContent=$('stats-title').textContent+'：'+plotted.map(p=>p.key+' '+fmt(p.value)+'项').join('；');
};
const renderAll=()=>{
 const rows=periodRows();
 $('period-name').textContent=periodName();$('period-name').title=period().join(' — ');
 document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===state.mode)));
 document.querySelectorAll('[data-source]').forEach(b=>b.setAttribute('aria-pressed',String(state.sources.has(b.dataset.source))));
 document.querySelectorAll('[data-date-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.dateMode===state.dateMode)));
 ['note','task','project'].forEach(k=>{$('count-'+k).textContent=fmt(rows.filter(r=>r.kind===k).length);$('count-label-'+k).textContent=metricTitle(k);});
 $('count-overdue').textContent=fmt(data.filter(r=>matches(r)&&overdue(r)).length);
 syncNodeFilters();
 saveSettings();
 const [lo,hi]=period();if(!state.selectedDate||state.selectedDate<lo||state.selectedDate>hi)state.selectedDate=lo;
 renderCalendar();renderStats();renderSidebar();
};
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{state.mode=b.dataset.mode;renderAll();if(state.dateMode==='continuous')calendarFocus(state.selectedDate);});
document.querySelectorAll('[data-date-mode]').forEach(b=>b.onclick=()=>{state.dateMode=b.dataset.dateMode;state.sortKey=state.dateMode==='due'?'due':'start';$('sort-key').value=state.sortKey;renderAll();if(state.dateMode==='continuous')calendarFocus(state.selectedDate);});
const move=n=>{const y=state.anchor.getUTCFullYear(),m=state.anchor.getUTCMonth();state.anchor=state.mode==='week'?add(state.anchor,7*n):first(y+(state.mode==='year'?n:0),m+(state.mode==='quarter'?3*n:state.mode==='month'?n:0));state.history=[];state.side=null;state.selectedDate=period()[0];renderAll();};
$('prev').onclick=()=>move(-1);$('next').onclick=()=>move(1);
$('snapshot-period').onclick=()=>{state.anchor=parse(meta.snapshot_date);state.selectedDate=meta.snapshot_date;state.side={type:'date',date:meta.snapshot_date};state.history=[];renderAll();};
$('filters-toggle').onclick=()=>{const open=$('filters').hidden;$('filters').hidden=!open;$('filters-toggle').setAttribute('aria-expanded',String(open));};
const doSearch=()=>{
 $('clear-search').hidden=!$('search').value;refreshSearch();state.history=[];
 state.side=searchQueries.length?{type:'search'}:{type:'date',date:state.selectedDate||meta.snapshot_date};
 renderAll();
};
let searchTimer,composing=false;
$('search').addEventListener('compositionstart',()=>{composing=true;clearTimeout(searchTimer);});
$('search').addEventListener('compositionend',()=>{composing=false;doSearch();});
$('search').oninput=()=>{clearTimeout(searchTimer);if(!composing)searchTimer=setTimeout(doSearch,150);};
$('clear-search').onclick=()=>{$('search').value='';doSearch();$('search').focus();};
['mode','condition','scope'].forEach(k=>$('search-'+k).onchange=doSearch);
$('search-reset').onclick=()=>{Object.entries(searchDefaults).forEach(([k,v])=>$('search-'+k).value=v);doSearch();};
$('node-filter').onchange=()=>{const value=$('node-filter').value;if(!['all','project','task','note'].includes(value)){$('node-filter').value=state.nodeFilter;return;}state.nodeFilter=value;renderAll();};
$('status-filter').onchange=()=>{if(!$('status-filter').disabled){state.statusFilter=$('status-filter').value;renderAll();}};
$('restore-filters').onclick=restoreNodeFilters;
$('restore-display').onclick=()=>{state.sortKey=state.dateMode==='due'?'due':'start';state.sortDirection='asc';state.sortGroup=true;state.fields={project:[],task:[],note:[]};state.nameWidth=240;syncConfig();renderAll();};

$('stats-source').onchange=()=>{$('stats-shape').value='';refreshDimensions();renderStats();saveSettings();};
$('stats-dimension').onchange=()=>{refreshChartOptions();renderStats();saveSettings();};
$('stats-shape').onchange=()=>{renderStats();saveSettings();};
$('side-back').onclick=()=>{if(state.history.length){state.side=state.history.pop();renderSidebar();}};
$('side-close').onclick=()=>{state.side=null;state.history=[];renderSidebar();};
const media=matchMedia('(prefers-color-scheme: dark)');
const applyTheme=()=>{document.documentElement.dataset.theme=state.theme==='auto'?media.matches?'dark':'light':state.theme;$('theme-toggle').textContent='主题：'+({auto:'自动',light:'明亮',dark:'暗黑'}[state.theme]);renderStats();};
$('theme-toggle').onclick=()=>{state.theme=['auto','light','dark'][(['auto','light','dark'].indexOf(state.theme)+1)%3];applyTheme();saveSettings();};
media.addEventListener?.('change',()=>{if(state.theme==='auto')applyTheme();});
const splitter=$('splitter');let resizing=false;
const setSideWidth=w=>{const width=Math.min(520,Math.max(280,w));$('layout').style.setProperty('--side-width',width+'px');splitter.setAttribute('aria-valuenow',String(Math.round(width)));};
splitter.onpointerdown=e=>{if(innerWidth<=1000)return;resizing=true;splitter.setPointerCapture(e.pointerId);e.preventDefault();};
splitter.onpointermove=e=>{if(resizing)setSideWidth($('layout').getBoundingClientRect().right-e.clientX);};
splitter.onpointerup=()=>resizing=false;splitter.onpointercancel=()=>resizing=false;splitter.ondblclick=()=>setSideWidth(358);
splitter.onkeydown=e=>{const w=Number(splitter.getAttribute('aria-valuenow'));if(e.key==='ArrowLeft'){setSideWidth(w+16);e.preventDefault();}if(e.key==='ArrowRight'){setSideWidth(w-16);e.preventDefault();}};
const navigateDate=delta=>{
 const next=iso(add(parse(state.selectedDate||period()[0]),delta)),[lo,hi]=period();
 state.selectedDate=next;state.history=[];state.side={type:'date',date:next};
 if(next<lo||next>hi)state.anchor=parse(next);
 renderAll();calendarFocus(next);
};
document.addEventListener('keydown',e=>{
 if(document.getElementById('diagnostics-dialog').open)return;
 if(e.key==='Escape'){
  if(!$('view-settings-panel').hidden){e.preventDefault();closeConfigPanels();$('view-settings-toggle').focus();return;}
  if(!$('filters').hidden){$('filters').hidden=true;$('filters-toggle').setAttribute('aria-expanded','false');}
  else if(state.history.length){state.side=state.history.pop();renderSidebar();}
  else{state.side=null;state.selectedDate=null;renderSidebar();renderCalendar();}
  return;
 }
 if(!$('calendar').contains(e.target)||e.target.closest('input,select,textarea'))return;
 const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[e.key];
 if(delta!==undefined){e.preventDefault();navigateDate(delta);}
 else if(e.key==='Enter'&&e.target.dataset.day){e.preventDefault();selectDay(e.target.dataset.day);$('side-back').focus();}
});
Object.entries(searchDefaults).forEach(([k,v])=>$('search-'+k).value=v);
loadSettings();syncConfig();bindConfig();refreshSearch();refreshDimensions();renderAll();applyTheme();
const testApi={data,statSpec,statRows,statDate,sortRows,restoreNodeFilters,isoWeek,renderGantt,dimensionKeys,state,period,periodRows,dateRows,dimensions,dimensionKey,matches,renderAll,selectRecord,selectDay,heatLevel,navigateDate,displayRange,packWeek,refreshSearch,fieldMatch,parseSearch,renderStats};
const applyPayload=next=>{
 data=next.records;Object.assign(meta,next.meta);rebuildRelations();searchFields=buildSearchFields();rebuildDates();refreshSearch();
 const selectionRemoved=state.side?.type==='record'&&!byUrl.has(state.side.url);if(selectionRemoved){state.side=null;state.history=[];}
 state.history=state.history.filter(s=>s.type!=='record'||byUrl.has(s.url));
 $('locate-hint').textContent='数据快照：'+meta.snapshot_date+' '+meta.snapshot_time+'；日历“今天”指系统日期。';
 renderAll();
 if(['localhost','127.0.0.1'].includes(location.hostname))window.snapshotTest={...testApi,data,applyPayload};
 return {selectionRemoved};
};
if(['localhost','127.0.0.1'].includes(location.hostname))window.snapshotTest={...testApi,applyPayload};
return {applyPayload};
};
let dashboard=null,csrf='',active=false;
const status=document.getElementById('online-status'),boot=document.getElementById('boot-message'),syncButton=document.getElementById('online-sync');
const messages={NOTION_TOKEN_REQUIRED:'同步未完成：请配置 Notion 集成密钥；已有数据保留。',DATA_SOURCE_IDS_REQUIRED:'同步未完成：请核对三库 Data Source ID 配置；已有数据保留。',AUTH_REQUIRED:'登录已过期，请重新登录。',NOTION_HTTP_401:'Notion 集成密钥无效。',NOTION_HTTP_403:'Notion 集成没有读取权限。',NOTION_HTTP_404:'Notion 数据源不存在或未授权。',PERSISTENT_CACHE_REQUIRED:'请配置持久 Redis 缓存。',CACHE_UNAVAILABLE:'Redis 暂不可用，已有显示数据不会被清空。',RATE_LIMITED:'操作过于频繁，请稍后重试。'};
async function request(path,options={}){const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options,headers:{...(options.method==='POST'?{'x-csrf-token':csrf}:{}),...options.headers}});const body=await response.json();if(response.status===401){location.replace('/login');throw Error('AUTH_REQUIRED');}if(!response.ok)throw Error(body.error||'SERVICE_UNAVAILABLE');return body;}
function validPayload(value){return value&&Array.isArray(value.records)&&value.meta&&/^\d{4}-\d{2}-\d{2}$/.test(value.meta.snapshot_date)&&value.records.every(r=>['project','task','note'].includes(r.kind)&&/^https:\/\/www\.notion\.so\/[a-f0-9]{32}$/.test(r.url)&&[r.projects,r.related,r.effective_projects,r.inherited_projects,r.people].every(Array.isArray)&&[r.start_date,r.due_date].every(d=>d===null||/^\d{4}-\d{2}-\d{2}$/.test(d)));}
async function loadData(){const payload=await request('/api/calendar');if(!validPayload(payload))throw Error('INVALID_DATA');let update;if(!dashboard)dashboard=initializeDashboard(payload);else update=dashboard.applyPayload(payload);document.getElementById('dashboard').hidden=false;boot.hidden=true;document.getElementById('online-data').textContent='当前数据：'+payload.meta.snapshot_date+' '+payload.meta.snapshot_time+'（Asia/Shanghai） · 在线版 1.1.0';status.textContent=update?.selectionRemoved?'同步完成，所选记录已不在当前数据源中。':'数据已连接。';}
async function sync({auto=false,full=false}={}){if(active)return;active=true;syncButton.disabled=true;document.getElementById('online-full').disabled=true;const until=Date.now()+180000;
 try{if(!csrf)csrf=(await request('/api/session')).csrf;let mode=auto?'?auto=1':full?'?full=1':'';
  while(Date.now()<until){status.textContent='正在同步数据库；已有日历仍可操作。';const result=await request('/api/sync'+mode,{method:'POST'});mode='';if(['complete','skipped'].includes(result.status)){await loadData();return;}status.textContent=result.status==='busy'?'其他请求正在同步，等待完成…':'同步进度已保存，正在断点续传…';await new Promise(r=>setTimeout(r,result.status==='busy'?2000:500));}
  status.textContent='同步进度已保存，本轮暂停。再次点击同步可继续。';
 }catch(error){const message=messages[error.message]||'同步未完成（'+error.message+'），已有数据保留，可稍后重试。';status.textContent=message;if(!dashboard){boot.textContent=message;boot.hidden=false;}}
 finally{active=false;syncButton.disabled=false;document.getElementById('online-full').disabled=false;}
}
async function start(){try{const currentSession=await request('/api/session');csrf=currentSession.csrf;setTimeout(()=>location.replace('/login'),Math.max(0,currentSession.expiresAt-Date.now()));try{await loadData();}catch(error){if(error.message!=='BOOTSTRAP_REQUIRED')throw error;}syncButton.disabled=false;await sync({auto:true});}catch(error){status.textContent=messages[error.message]||'连接未完成（'+error.message+'），可点击同步重试。';boot.textContent=status.textContent;syncButton.disabled=false;}}
syncButton.onclick=()=>sync();
document.getElementById('online-logout').onclick=async()=>{try{await request('/api/logout',{method:'POST'});try{localStorage.removeItem('notion-calendar-ui-v1');}catch{}location.replace('/login');}catch(error){status.textContent=messages[error.message]||'退出失败，请重试。';}};
const dialog=document.getElementById('diagnostics-dialog');document.getElementById('diagnostics-close').onclick=()=>dialog.close();
document.getElementById('online-diagnostics').onclick=async()=>{dialog.showModal();const target=document.getElementById('diagnostics-content');target.textContent='正在读取…';try{target.textContent=JSON.stringify(await request('/api/diagnostics'),null,2);}catch(error){target.textContent=messages[error.message]||error.message;}};
document.getElementById('online-full').onclick=()=>{dialog.close();sync({full:true});};
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
start();
})()
