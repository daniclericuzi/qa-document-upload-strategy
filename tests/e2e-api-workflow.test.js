const { test, expect } = require('@playwright/test')
const express = require('express')
const multer = require('multer')
const supertest = require('supertest')

const apiResponses = require('../tests/fixtures/api-responses.json')
const ApiClient = require('../tests/helpers/ApiClient')

const app = express()
app.use(express.json())

const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true)
    } else {
      cb(new Error('Only PDF files are allowed'), false)
    }
  }
})

let serviceUnavailable = false

app.post('/api/extract', (req, res) => {
  if (serviceUnavailable) {
    return res.status(503).json(apiResponses.serviceUnavailable)
  }
  upload.single('document')(req, res, (err) => {
    if (err) return res.status(422).json(apiResponses.invalidFileType)
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        error: { code: 'NO_FILE', message: 'No file uploaded' }
      })
    }
    if (req.file.originalname.includes('corrupted')) {
      return res.status(422).json(apiResponses.extractionFailed)
    }
    if (req.file.originalname.includes('partial')) {
      return res.json(apiResponses.partialExtraction)
    }
    if (req.file.originalname.includes('timeout')) {
      return res.status(408).json(apiResponses.timeout)
    }
    res.json(apiResponses.successfulExtraction)
  })
})

app.get('/api/extract/status/:id', (req, res) => {
  res.json(apiResponses.successfulExtraction)
})

app.post('/api/save/:id', (req, res) => {
  const { processedData } = req.body
  if (!processedData?.invoiceNumber || !processedData?.totalAmount) {
    return res.status(400).json({
      status: 'error',
      error: { code: 'VALIDATION_ERROR', message: 'Required fields cannot be empty' }
    })
  }
  res.json({ status: 'success', savedId: `saved-${req.params.id}` })
})

app.get('/api/data/:id', (req, res) => {
  res.json({ status: 'success', ...apiResponses.successfulExtraction.data.extractedData })
})

const client = new ApiClient(supertest(app))

test.describe('Document Upload & Data Extraction - E2E Workflow', () => {

  test('should run full document processing workflow', async () => {
    const uploadResponse = await client.extractDocument(
      Buffer.from('%PDF-1.4 valid content'),
      'sample-invoice.pdf'
    )

    expect(uploadResponse.status).toBe(200)
    expect(uploadResponse.body.status).toBe('success')

    const { id, extractedData } = uploadResponse.body.data
    expect(extractedData.invoiceNumber).toBeDefined()
    expect(extractedData.customerName).toBeDefined()
    expect(extractedData.totalAmount).toBeGreaterThan(0)

    const saveResponse = await client.saveExtraction(id, extractedData)

    expect(saveResponse.status).toBe(200)
    expect(saveResponse.body.status).toBe('success')
    expect(saveResponse.body.savedId).toBeDefined()
  })

  test('should handle extraction failure', async () => {
    const response = await client.extractDocument(
      Buffer.from('not a real pdf'),
      'corrupted.pdf'
    )

    expect(response.status).toBe(422)
    expect(response.body.status).toBe('error')
    expect(response.body.error.code).toBe('EXTRACTION_FAILED')
  })

  test('should support data editing before save', async () => {
    const uploadResponse = await client.extractDocument(
      Buffer.from('%PDF-1.4 valid content'),
      'sample-invoice.pdf'
    )

    expect(uploadResponse.status).toBe(200)
    const { id, extractedData } = uploadResponse.body.data

    const modifiedData = { ...extractedData, customerName: 'Updated Corporation Name' }

    const saveResponse = await client.saveExtraction(
      id,
      modifiedData,
      { customerName: 'Updated Corporation Name' }
    )

    expect(saveResponse.status).toBe(200)
    expect(saveResponse.body.status).toBe('success')
  })

  test('should handle API timeout', async () => {
    const response = await client.extractDocument(
      Buffer.from('%PDF-1.4 content'),
      'timeout.pdf'
    )

    expect(response.status).toBe(408)
    expect(response.body.status).toBe('error')
    expect(response.body.error.code).toBe('PROCESSING_TIMEOUT')
  })

  test('should handle partial extraction', async () => {
    const response = await client.extractDocument(
      Buffer.from('%PDF-1.4 scanned content'),
      'partial.pdf'
    )

    expect(response.status).toBe(200)
    expect(response.body.data.extractedData.invoiceNumber).toBeDefined()
    expect(response.body.data.extractedData.customerName).toBeNull()
    expect(response.body.data.missingFields).toContain('customerName')
  })

  test('should reject when processing service is unavailable', async () => {
    serviceUnavailable = true

    const response = await client.extractDocument(
      Buffer.from('%PDF-1.4 content'),
      'sample-invoice.pdf'
    )

    expect(response.status).toBe(503)
    expect(response.body.status).toBe('error')
    expect(response.body.error.code).toBe('SERVICE_UNAVAILABLE')

    serviceUnavailable = false
  })

  test('should produce consistent structure for the same PDF processed twice', async () => {
    const upload = () => client.extractDocument(
      Buffer.from('%PDF-1.4 valid content'),
      'sample-invoice.pdf'
    )

    const [result1, result2] = await Promise.all([upload(), upload()])

    expect(result1.body.data.extractedData.invoiceNumber)
      .toBe(result2.body.data.extractedData.invoiceNumber)
    expect(result1.body.data.extractedData.totalAmount)
      .toBe(result2.body.data.extractedData.totalAmount)
  })

  test('should block save when required fields are empty', async () => {
    const uploadResponse = await client.extractDocument(
      Buffer.from('%PDF-1.4 valid content'),
      'sample-invoice.pdf'
    )

    const { id, extractedData } = uploadResponse.body.data

    const saveResponse = await client.saveExtraction(
      id,
      { ...extractedData, invoiceNumber: '', totalAmount: null }
    )

    expect(saveResponse.status).toBe(400)
    expect(saveResponse.body.error.code).toBe('VALIDATION_ERROR')
  })

})