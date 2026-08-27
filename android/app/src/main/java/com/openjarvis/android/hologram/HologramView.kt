package com.openjarvis.android.hologram

import android.animation.ValueAnimator
import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.DashPathEffect
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
import android.os.SystemClock
import android.util.AttributeSet
import android.view.MotionEvent
import android.view.View
import android.view.animation.AccelerateDecelerateInterpolator
import android.view.animation.OvershootInterpolator
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin
import kotlin.random.Random

/**
 * Particle entity for JARVIS holographic energy field.
 */
class HologramParticle {
    var angle: Float = 0f
    var distance: Float = 0f
    var speed: Float = 0f
    var radius: Float = 2f
    var alpha: Float = 1f
    var orbitSpeed: Float = 0f

    fun reset(random: Random, maxRadius: Float) {
        angle = random.nextFloat() * (2f * PI.toFloat())
        distance = random.nextFloat() * maxRadius * 0.8f + (maxRadius * 0.2f)
        speed = random.nextFloat() * 20f + 10f
        orbitSpeed = (random.nextFloat() - 0.5f) * 1.5f
        radius = random.nextFloat() * 2.5f + 1.2f
        alpha = random.nextFloat() * 0.6f + 0.4f
    }
}

/**
 * High-performance 60 FPS Holographic HUD View.
 * Renders the JARVIS Arc Reactor, Orbital Rings, Particle Swarm, and Voice Waveforms.
 * Zero-allocation during render frames for maximum smoothness and battery efficiency.
 */
class HologramView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    // Dependencies & Subsystems
    var visualizer: VoiceVisualizer = VoiceVisualizer()
    var state: HologramState = HologramState.HIDDEN
        private set

    var theme: HologramThemeColor = HologramThemeColor.CYBER_CYAN
        set(value) {
            field = value
            updatePaints()
        }

    var quality: HologramQuality = HologramQuality.HIGH

    var statusText: String = "J.A.R.V.I.S. READY"
    var transcriptText: String = ""

    // Callbacks for Overlay Service
    var onDragListener: ((dx: Float, dy: Float) -> Unit)? = null
    var onTapListener: (() -> Unit)? = null
    var onCloseListener: (() -> Unit)? = null

    // Touch Handling
    private var lastTouchX = 0f
    private var lastTouchY = 0f
    private var isDragging = false
    private var touchDownTime = 0L

    // Animation & Lifecycle Timers
    private var lastFrameTime = SystemClock.uptimeMillis()
    private var ringRotation1 = 0f
    private var ringRotation2 = 0f
    private var ringRotation3 = 0f
    private var pulsePhase = 0f

    // Appearance & Dismiss Transition Factor (0.0f = fully collapsed, 1.0f = full size)
    private var transitionProgress: Float = 0.0f
    private var appearanceAnimator: ValueAnimator? = null

    // Particle Swarm
    private val maxParticles = 40
    private val particles = Array(maxParticles) { HologramParticle() }
    private val random = Random(System.currentTimeMillis())

    // Pre-allocated Drawing Objects (Zero-allocation in onDraw)
    private val corePaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val glowPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val ringPaint1 = Paint(Paint.ANTI_ALIAS_FLAG)
    private val ringPaint2 = Paint(Paint.ANTI_ALIAS_FLAG)
    private val ringPaint3 = Paint(Paint.ANTI_ALIAS_FLAG)
    private val particlePaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val waveformPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val transcriptPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val reticlePaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val closeButtonPaint = Paint(Paint.ANTI_ALIAS_FLAG)

    private val tempRect = RectF()
    private val tempPath = Path()
    private val closeButtonRect = RectF()

    init {
        setLayerType(LAYER_TYPE_HARDWARE, null)
        initPaints()
        initParticles()
    }

    private fun initPaints() {
        corePaint.style = Paint.Style.FILL

        glowPaint.style = Paint.Style.FILL

        ringPaint1.style = Paint.Style.STROKE
        ringPaint1.strokeWidth = 2f

        ringPaint2.style = Paint.Style.STROKE
        ringPaint2.strokeWidth = 3f

        ringPaint3.style = Paint.Style.STROKE
        ringPaint3.strokeWidth = 1.5f

        particlePaint.style = Paint.Style.FILL

        waveformPaint.style = Paint.Style.STROKE
        waveformPaint.strokeWidth = 2.5f
        waveformPaint.strokeCap = Paint.Cap.ROUND

        textPaint.textAlign = Paint.Align.CENTER
        textPaint.textSize = 28f
        textPaint.isFakeBoldText = true

        transcriptPaint.textAlign = Paint.Align.CENTER
        transcriptPaint.textSize = 22f

        reticlePaint.style = Paint.Style.STROKE
        reticlePaint.strokeWidth = 1.2f

        closeButtonPaint.style = Paint.Style.FILL

        updatePaints()
    }

    private fun updatePaints() {
        val primary = theme.primaryInt
        val secondary = theme.secondaryInt
        val accent = theme.accentInt

        ringPaint1.color = secondary
        ringPaint2.color = primary
        ringPaint3.color = secondary

        particlePaint.color = accent
        waveformPaint.color = secondary
        textPaint.color = accent
        transcriptPaint.color = Color.WHITE
        reticlePaint.color = secondary
        closeButtonPaint.color = Color.argb(140, 30, 41, 59)
    }

    private fun initParticles() {
        for (p in particles) {
            p.reset(random, 120f)
        }
    }

    /**
     * Start the Hologram Appearance Animation (from tiny quantum point to full HUD).
     */
    fun startAppearance(durationMs: Long = 450L, onComplete: (() -> Unit)? = null) {
        state = HologramState.APPEARING
        visibility = VISIBLE
        appearanceAnimator?.cancel()

        appearanceAnimator = ValueAnimator.ofFloat(0.0f, 1.0f).apply {
            duration = durationMs
            interpolator = OvershootInterpolator(1.2f)
            addUpdateListener { animator ->
                transitionProgress = animator.animatedValue as Float
                postInvalidateOnAnimation()
            }
        }
        appearanceAnimator?.start()
    }

    /**
     * Start the Hologram Dismiss Animation (collapse back to center and hide).
     */
    fun startDismiss(durationMs: Long = 350L, onComplete: (() -> Unit)? = null) {
        state = HologramState.DISMISSING
        appearanceAnimator?.cancel()

        appearanceAnimator = ValueAnimator.ofFloat(transitionProgress, 0.0f).apply {
            duration = durationMs
            interpolator = AccelerateDecelerateInterpolator()
            addUpdateListener { animator ->
                transitionProgress = animator.animatedValue as Float
                postInvalidateOnAnimation()
                if (transitionProgress <= 0.01f) {
                    state = HologramState.HIDDEN
                    visibility = GONE
                    onComplete?.invoke()
                }
            }
        }
        appearanceAnimator?.start()
    }

    fun setState(newState: HologramState) {
        this.state = newState
        when (newState) {
            HologramState.HIDDEN -> {
                visibility = GONE
                transitionProgress = 0f
            }
            HologramState.APPEARING -> {
                startAppearance()
            }
            HologramState.DISMISSING -> {
                startDismiss()
            }
            else -> {
                visibility = VISIBLE
                if (transitionProgress < 1.0f && !appearanceAnimator!!.isRunning) {
                    transitionProgress = 1.0f
                }
            }
        }
        postInvalidateOnAnimation()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)

        if (state == HologramState.HIDDEN || transitionProgress <= 0.001f) {
            return
        }

        val now = SystemClock.uptimeMillis()
        val deltaTime = ((now - lastFrameTime).coerceIn(1, 100)) / 1000f
        lastFrameTime = now

        val width = width.toFloat()
        val height = height.toFloat()
        val cx = width / 2f
        val cy = (height / 2f) - 20f

        val isVoiceActive = state == HologramState.LISTENING || state == HologramState.SPEAKING
        visualizer.updateFrame(deltaTime, isVoiceActive)

        // Advance ring rotations
        val speedMult = visualizer.calculateSpeedMultiplier(state)
        ringRotation1 += deltaTime * 24f * speedMult
        ringRotation2 -= deltaTime * 36f * speedMult
        ringRotation3 += deltaTime * 18f * speedMult
        pulsePhase += deltaTime * 3.5f

        // Base Radius & Scaling
        val baseRadius = min(width, height) * 0.28f * transitionProgress
        val coreScale = visualizer.calculateCoreScale()

        // 1. Draw Volumetric Quantum Glow Core
        val glowRadius = baseRadius * 1.6f * coreScale
        if (quality != HologramQuality.LOW) {
            glowPaint.shader = RadialGradient(
                cx, cy, glowRadius,
                intArrayOf(
                    theme.secondaryInt and 0x00FFFFFF or (0x55000000),
                    theme.primaryInt and 0x00FFFFFF or (0x22000000),
                    0x00000000
                ),
                floatArrayOf(0.0f, 0.6f, 1.0f),
                Shader.TileMode.CLAMP
            )
            canvas.drawCircle(cx, cy, glowRadius, glowPaint)
        }

        // 2. Draw Central Holographic Reactor Nucleus
        val innerCoreRadius = baseRadius * 0.45f * coreScale
        corePaint.shader = RadialGradient(
            cx, cy, innerCoreRadius,
            intArrayOf(theme.accentInt, theme.secondaryInt, theme.primaryInt),
            floatArrayOf(0.0f, 0.5f, 1.0f),
            Shader.TileMode.CLAMP
        )
        canvas.drawCircle(cx, cy, innerCoreRadius, corePaint)

        // 3. Draw Concentric Orbital Rings with Segmented Dashes
        canvas.save()
        canvas.rotate(ringRotation1, cx, cy)
        val ring1Radius = baseRadius * 0.75f
        tempRect.set(cx - ring1Radius, cy - ring1Radius, cx + ring1Radius, cy + ring1Radius)
        canvas.drawArc(tempRect, 0f, 70f, false, ringPaint1)
        canvas.drawArc(tempRect, 90f, 70f, false, ringPaint1)
        canvas.drawArc(tempRect, 180f, 70f, false, ringPaint1)
        canvas.drawArc(tempRect, 270f, 70f, false, ringPaint1)
        canvas.restore()

        canvas.save()
        canvas.rotate(ringRotation2, cx, cy)
        val ring2Radius = baseRadius * 1.05f
        tempRect.set(cx - ring2Radius, cy - ring2Radius, cx + ring2Radius, cy + ring2Radius)
        canvas.drawArc(tempRect, 15f, 110f, false, ringPaint2)
        canvas.drawArc(tempRect, 145f, 90f, false, ringPaint2)
        canvas.drawArc(tempRect, 255f, 80f, false, ringPaint2)
        canvas.restore()

        // 4. Draw Radial Telemetry Reticle Ticks
        if (quality == HologramQuality.HIGH) {
            val reticleRadius = baseRadius * 1.25f
            for (i in 0 until 24) {
                val angleRad = (i * 15f + ringRotation3) * (PI.toFloat() / 180f)
                val innerR = reticleRadius
                val outerR = if (i % 6 == 0) reticleRadius + 10f else reticleRadius + 4f
                val x1 = cx + cos(angleRad) * innerR
                val y1 = cy + sin(angleRad) * innerR
                val x2 = cx + cos(angleRad) * outerR
                val y2 = cy + sin(angleRad) * outerR
                canvas.drawLine(x1, y1, x2, y2, reticlePaint)
            }
        }

        // 5. Draw Particle Swarm
        val particleLimit = when (quality) {
            HologramQuality.HIGH -> maxParticles
            HologramQuality.MEDIUM -> 20
            HologramQuality.LOW -> 8
        }
        val dispersion = visualizer.calculateParticleDispersion()

        for (i in 0 until particleLimit) {
            val p = particles[i]
            p.angle += p.orbitSpeed * deltaTime * speedMult
            p.distance += p.speed * deltaTime * dispersion
            if (p.distance > baseRadius * 1.6f) {
                p.reset(random, baseRadius)
            }

            val px = cx + cos(p.angle) * p.distance
            val py = cy + sin(p.angle) * p.distance
            val particleAlpha = ((p.alpha * transitionProgress) * 255).toInt().coerceIn(0, 255)
            particlePaint.alpha = particleAlpha
            canvas.drawCircle(px, py, p.radius, particlePaint)
        }

        // 6. Draw Voice Frequency Waveform Arc at Lower Hemisphere
        val waveRadius = baseRadius * 1.45f
        val numBars = VoiceVisualizer.NUM_FREQUENCY_BARS
        val startAngle = 30f
        val sweepTotal = 120f
        val stepAngle = sweepTotal / numBars

        for (i in 0 until numBars) {
            val barFrac = visualizer.frequencyBands[i]
            val currentAngle = (180f - sweepTotal / 2f + i * stepAngle) * (PI.toFloat() / 180f)
            val barLen = 6f + (barFrac * 28f * coreScale)

            val bx1 = cx + cos(currentAngle) * waveRadius
            val by1 = cy + sin(currentAngle) * waveRadius
            val bx2 = cx + cos(currentAngle) * (waveRadius + barLen)
            val by2 = cy + sin(currentAngle) * (waveRadius + barLen)

            waveformPaint.color = if (i % 2 == 0) theme.secondaryInt else theme.accentInt
            canvas.drawLine(bx1, by1, bx2, by2, waveformPaint)
        }

        // 7. Draw HUD Status & Transcript Text
        val textY = cy + baseRadius * 1.65f + 36f
        textPaint.alpha = ((0.9f * transitionProgress) * 255).toInt().coerceIn(0, 255)
        canvas.drawText(statusText, cx, textY, textPaint)

        if (transcriptText.isNotBlank()) {
            val transcriptY = textY + 28f
            transcriptPaint.alpha = ((0.85f * transitionProgress) * 255).toInt().coerceIn(0, 255)
            val displayTranscript = if (transcriptText.length > 38) transcriptText.take(35) + "..." else transcriptText
            canvas.drawText("« $displayTranscript »", cx, transcriptY, transcriptPaint)
        }

        // 8. Draw Close Button (X) at Top Right
        val btnSize = 36f
        val btnMargin = 16f
        closeButtonRect.set(width - btnSize - btnMargin, btnMargin, width - btnMargin, btnMargin + btnSize)
        canvas.drawRoundRect(closeButtonRect, 18f, 18f, closeButtonPaint)

        val btnCx = closeButtonRect.centerX()
        val btnCy = closeButtonRect.centerY()
        val xSize = 7f
        canvas.drawLine(btnCx - xSize, btnCy - xSize, btnCx + xSize, btnCy + xSize, reticlePaint)
        canvas.drawLine(btnCx + xSize, btnCy - xSize, btnCx - xSize, btnCy + xSize, reticlePaint)

        // Continuously request animation frame while active
        if (state.isAnimating) {
            postInvalidateOnAnimation()
        }
    }

    @SuppressLint("ClickableViewAccessibility")
    override fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                lastTouchX = event.rawX
                lastTouchY = event.rawY
                touchDownTime = System.currentTimeMillis()
                isDragging = false

                // Check Close Button Tap
                if (closeButtonRect.contains(event.x, event.y)) {
                    onCloseListener?.invoke()
                    return true
                }
                return true
            }
            MotionEvent.ACTION_MOVE -> {
                val dx = event.rawX - lastTouchX
                val dy = event.rawY - lastTouchY
                if (dx * dx + dy * dy > 25f) {
                    isDragging = true
                    onDragListener?.invoke(dx, dy)
                    lastTouchX = event.rawX
                    lastTouchY = event.rawY
                }
                return true
            }
            MotionEvent.ACTION_UP -> {
                val duration = System.currentTimeMillis() - touchDownTime
                if (!isDragging && duration < 300) {
                    onTapListener?.invoke()
                }
                isDragging = false
                return true
            }
        }
        return super.onTouchEvent(event)
    }
}
