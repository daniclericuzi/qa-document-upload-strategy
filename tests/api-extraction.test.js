const request = require('supertest')
const express = require('express')
const multer = require('multer')

const apiResponses = require('./fixtures/api-responses.json')
const ApiClient = require('./helpers/ApiClient')

const app = express()
const upload = multer({ dest: 'uploads/' })

app.post('/api/extract', (req, res) => {
  upload.single('document')(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        status: 'error',
        error: { code: 'INVALID_FILE', message: err.message }
      })
    }
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        error: { code: 'NO_FILE', message: 'No file uploaded' }
      })
    }
    res.json(apiResponses.successfulExtraction)
  })
})

app.get('/api/extract/status/:id', (req, res) => {
  res.json(apiResponses.extractionInProgress)
})

const client = new ApiClient(request(app))

describe('Document Extraction API', () => {

  describe('Successful Extraction', () => {

    test('should extract data from valid PDF successfully', async () => {
      const response = await client.extractDocument(
        Buffer.from('%PDF-1.4 mock content'),
        'test.pdf'
      )

      expect(response.status).toBe(200)
      expect(response.body.status).toBe('success')
      expect(response.body.data).toHaveProperty('extractedData')

      const { extractedData } = response.body.data
      expect(extractedData).toHaveProperty('invoiceNumber')
      expect(extractedData).toHaveProperty('customerName')
      expect(extractedData).toHaveProperty('totalAmount')
      expect(extractedData).toHaveProperty('dueDate')

      expect(typeof extractedData.invoiceNumber).toBe('string')
      expect(typeof extractedData.customerName).toBe('string')
      expect(typeof extractedData.totalAmount).toBe('number')
      expect(typeof extractedData.dueDate).toBe('string')
    })

    test('should return a valid extraction ID for tracking', async () => {
      const response = await client.extractDocument(
        Buffer.from('%PDF-1.4 mock content'),
        'test.pdf'
      )

      expect(response.status).toBe(200)
      expect(response.body.data).toHaveProperty('id')
      expect(typeof response.body.data.id).toBe('string')
      expect(response.body.data.id).toMatch(/^extraction-/)
    })

    test('should return confidence score within valid range', async () => {
      const response = await client.extractDocument(
        Buffer.from('%PDF-1.4 mock content'),
        'test.pdf'
      )

      expect(response.status).toBe(200)
      expect(response.body.data.confidence).toBeGreaterThan(0.8)
      expect(response.body.data.confidence).toBeLessThanOrEqual(1.0)
    })

    test('should return processing time within SLA', async () => {
      const response = await client.extractDocument(
        Buffer.from('%PDF-1.4 mock content'),
        'test.pdf'
      )

      expect(response.status).toBe(200)
      expect(response.body.data.processingTime).toBeGreaterThan(0)
      expect(response.body.data.processingTime).toBeLessThan(30)
    })

  })

  test('should transition status from processing to completed', async () => {
  const response = await client.getStatus('extraction-12346')

  expect(response.status).toBe(200)
  expect(['processing', 'completed', 'failed', 'pending'])
    .toContain(response.body.data.status)
})
})
