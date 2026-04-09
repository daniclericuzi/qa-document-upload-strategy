const request = require('supertest')
const express = require('express')
const multer = require('multer')

const apiResponses = require('./fixtures/api-responses.json')
const ApiClient = require('./helpers/ApiClient')

const app = express()
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

app.post('/api/extract', (req, res) => {
  upload.single('document')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json(apiResponses.fileTooLarge)
      }
      return res.status(422).json(apiResponses.invalidFileType)
    }
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        error: { code: 'NO_FILE', message: 'No file uploaded' }
      })
    }
    if (req.file.size === 0) {
      return res.status(422).json({
        status: 'error',
        error: { code: 'EMPTY_FILE', message: 'File is empty' }
      })
    }
    if (req.file.originalname.includes('corrupted')) {
      return res.status(422).json(apiResponses.extractionFailed)
    }
    res.json(apiResponses.successfulExtraction)
  })
})

const client = new ApiClient(request(app))

describe('File Upload Validation', () => {

  test('should reject unsupported file format (.docx)', async () => {
    const response = await client.extractDocument(
      Buffer.from('mock docx content'),
      'test.docx',
      'application/msword'
    )

    expect(response.status).toBe(422)
    expect(response.body.status).toBe('error')
    expect(response.body.error.code).toBe('INVALID_FILE_TYPE')
  })

  test('should reject unsupported file format (.png)', async () => {
    const response = await client.extractDocument(
      Buffer.from('mock png content'),
      'test.png',
      'image/png'
    )

    expect(response.status).toBe(422)
    expect(response.body.status).toBe('error')
    expect(response.body.error.code).toBe('INVALID_FILE_TYPE')
  })

  test('should reject files exceeding size limit', async () => {
    const largeBuffer = Buffer.alloc(11 * 1024 * 1024, 'a')

    const response = await client.extractDocument(
      largeBuffer,
      'large.pdf',
      'application/pdf'
    )

    expect(response.status).toBe(413)
    expect(response.body.status).toBe('error')
    expect(response.body.error.code).toBe('FILE_TOO_LARGE')
  })

  test('should handle empty PDF successfully', async () => {
    const response = await client.extractDocument(
      Buffer.alloc(0),
      'empty.pdf',
      'application/pdf'
    )

    expect(response.status).toBe(422)
    expect(response.body.status).toBe('error')
    expect(response.body.error.code).toBe('EMPTY_FILE')
  })

  test('should reject upload without a file', async () => {
    const response = await client.extractWithoutFile()

    expect(response.status).toBe(400)
    expect(response.body.status).toBe('error')
    expect(response.body.error.code).toBe('NO_FILE')
  })

  test('should handle corrupted PDF successfully', async () => {
    const response = await client.extractDocument(
      Buffer.from('corrupted binary content'),
      'corrupted.pdf',
      'application/pdf'
    )

    expect(response.status).toBe(422)
    expect(response.body.status).toBe('error')
    expect(response.body.error.code).toBe('EXTRACTION_FAILED')
  })

})