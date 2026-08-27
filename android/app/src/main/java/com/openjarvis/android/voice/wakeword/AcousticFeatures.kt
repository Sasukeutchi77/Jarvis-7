package com.openjarvis.android.voice.wakeword

import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.ln
import kotlin.math.log10
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * DSP Feature Extraction Engine for Acoustic Wake-Word Recognition.
 * Computes Mel-Frequency Cepstral Coefficients (MFCC), Spectral Centroid,
 * Spectral Flux, and Energy Dynamics from PCM audio frames.
 *
 * Optimized for low-latency, zero-allocation real-time processing on Android.
 */
class AcousticFeatures(
    val sampleRate: Int = 16000,
    val frameSize: Int = 400,        // 25 ms at 16kHz
    val frameStep: Int = 160,        // 10 ms hop at 16kHz
    val numMelFilters: Int = 20,     // 20 Mel-filterbanks (200Hz - 7500Hz)
    val numCepstra: Int = 13,        // 13 MFCC coefficients (c0..c12)
    val fftSize: Int = 512           // Power-of-2 FFT size
) {
    private val hammingWindow = FloatArray(frameSize)
    private val melFilterBank = Array(numMelFilters) { FloatArray(fftSize / 2 + 1) }
    private val dctMatrix = Array(numCepstra) { FloatArray(numMelFilters) }

    // Pre-allocated buffers for zero-allocation feature extraction
    private val fftReal = FloatArray(fftSize)
    private val fftImag = FloatArray(fftSize)
    private val powerSpectrum = FloatArray(fftSize / 2 + 1)
    private val melEnergies = FloatArray(numMelFilters)

    init {
        initializeHammingWindow()
        initializeMelFilterBank(200.0, 7500.0)
        initializeDctMatrix()
    }

    private fun initializeHammingWindow() {
        for (i in 0 until frameSize) {
            hammingWindow[i] = (0.54 - 0.46 * cos(2.0 * PI * i / (frameSize - 1))).toFloat()
        }
    }

    private fun hzToMel(hz: Double): Double = 2595.0 * log10(1.0 + hz / 700.0)
    private fun melToHz(mel: Double): Double = 700.0 * (Math.pow(10.0, mel / 2595.0) - 1.0)

    private fun initializeMelFilterBank(lowHz: Double, highHz: Double) {
        val lowMel = hzToMel(lowHz)
        val highMel = hzToMel(highHz)
        val melPoints = DoubleArray(numMelFilters + 2)
        val melStep = (highMel - lowMel) / (numMelFilters + 1)

        for (i in melPoints.indices) {
            melPoints[i] = lowMel + i * melStep
        }

        val hzPoints = DoubleArray(melPoints.size) { melToHz(melPoints[it]) }
        val binPoints = IntArray(hzPoints.size) {
            ((fftSize + 1) * hzPoints[it] / sampleRate).toInt().coerceIn(0, fftSize / 2)
        }

        for (m in 0 until numMelFilters) {
            val left = binPoints[m]
            val center = binPoints[m + 1]
            val right = binPoints[m + 2]

            for (k in left until center) {
                if (center > left) {
                    melFilterBank[m][k] = ((k - left).toFloat() / (center - left))
                }
            }
            for (k in center until right) {
                if (right > center) {
                    melFilterBank[m][k] = ((right - k).toFloat() / (right - center))
                }
            }
        }
    }

    private fun initializeDctMatrix() {
        for (i in 0 until numCepstra) {
            for (j in 0 until numMelFilters) {
                dctMatrix[i][j] = (cos(PI * i * (j + 0.5) / numMelFilters) * sqrt(2.0 / numMelFilters)).toFloat()
            }
        }
    }

    /**
     * Compute 13-dimensional MFCC vector for a single 25ms audio frame.
     */
    @Synchronized
    fun extractMfcc(frame: FloatArray, outMfcc: FloatArray) {
        val n = frame.size.coerceAtMost(frameSize)

        // 1. Apply Hamming Window & copy into FFT buffer
        for (i in 0 until fftSize) {
            if (i < n) {
                fftReal[i] = frame[i] * hammingWindow[i]
            } else {
                fftReal[i] = 0f
            }
            fftImag[i] = 0f
        }

        // 2. Compute Real FFT (In-place Radix-2 FFT)
        computeFft(fftReal, fftImag, fftSize)

        // 3. Compute Power Spectrum: P(k) = (Re^2 + Im^2) / N
        for (k in 0..fftSize / 2) {
            val re = fftReal[k]
            val im = fftImag[k]
            powerSpectrum[k] = (re * re + im * im) / fftSize
        }

        // 4. Filterbank Energy integration
        for (m in 0 until numMelFilters) {
            var energy = 0f
            val filter = melFilterBank[m]
            for (k in 0..fftSize / 2) {
                energy += powerSpectrum[k] * filter[k]
            }
            // Log energy with floor to prevent -infinity
            melEnergies[m] = ln(energy.coerceAtLeast(1e-6f))
        }

        // 5. Discrete Cosine Transform (DCT) -> MFCCs
        for (i in 0 until numCepstra) {
            var sum = 0f
            val row = dctMatrix[i]
            for (j in 0 until numMelFilters) {
                sum += melEnergies[j] * row[j]
            }
            outMfcc[i] = sum
        }
    }

    /**
     * Compute spectral centroid in Hz to distinguish vocal pitch and sibilants.
     */
    fun computeSpectralCentroid(powerSpectrum: FloatArray): Float {
        var weightedSum = 0f
        var totalPower = 0f
        val binWidthHz = sampleRate.toFloat() / fftSize

        for (k in powerSpectrum.indices) {
            val freq = k * binWidthHz
            weightedSum += freq * powerSpectrum[k]
            totalPower += powerSpectrum[k]
        }

        return if (totalPower > 1e-5f) weightedSum / totalPower else 0f
    }

    /**
     * Radix-2 Cooley-Tukey In-Place FFT for power-of-2 size.
     */
    private fun computeFft(real: FloatArray, imag: FloatArray, n: Int) {
        var j = 0
        for (i in 0 until n - 1) {
            if (i < j) {
                val tempR = real[i]
                real[i] = real[j]
                real[j] = tempR
                val tempI = imag[i]
                imag[i] = imag[j]
                imag[j] = tempI
            }
            var k = n shr 1
            while (k <= j) {
                j -= k
                k = k shr 1
            }
            j += k
        }

        var l = 1
        while (l < n) {
            val step = l shl 1
            val theta = -PI / l
            var uR = 1.0
            var uI = 0.0
            val wR = cos(theta)
            val wI = sin(theta)

            for (m in 0 until l) {
                var i = m
                while (i < n) {
                    val idx = i + l
                    val tr = (uR * real[idx] - uI * imag[idx]).toFloat()
                    val ti = (uR * imag[idx] + uI * real[idx]).toFloat()
                    real[idx] = real[i] - tr
                    imag[idx] = imag[i] - ti
                    real[i] += tr
                    imag[i] += ti
                    i += step
                }
                val nextUR = uR * wR - uI * wI
                val nextUI = uR * wI + uI * wR
                uR = nextUR
                uI = nextUI
            }
            l = step
        }
    }
}
