class ApiClient {
  constructor(app) {
    this.app = app
  }

  extractDocument(fileData, filename, mimetype = 'application/pdf') {
    return this.app
      .post('/api/extract')
      .attach('document', fileData, { filename, contentType: mimetype })
  }

  extractWithoutFile() {
    return this.app.post('/api/extract')
  }

  getStatus(extractionId) {
    return this.app.get(`/api/extract/status/${extractionId}`)
  }

  saveExtraction(extractionId, processedData, userModifications = {}) {
    return this.app
      .post(`/api/save/${extractionId}`)
      .send({ processedData, userModifications })
  }

  getData(savedId) {
    return this.app.get(`/api/data/${savedId}`)
  }
}

module.exports = ApiClient