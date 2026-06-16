import {expect} from 'chai'

import {HttpError, assertOk} from '@/lib/http-error'

describe('http-error', () => {
  it('HttpError stores status, headers, and body', () => {
    const headers = new Headers({'x-test': '1'})
    const error = new HttpError(403, headers, 'forbidden', 'custom message')

    expect(error.name).to.equal('HttpError')
    expect(error.status).to.equal(403)
    expect(error.headers).to.equal(headers)
    expect(error.body).to.equal('forbidden')
    expect(error.message).to.equal('custom message')
  })

  it('HttpError defaults message from status and body', () => {
    const error = new HttpError(500, new Headers(), 'server error')

    expect(error.message).to.equal('HTTP 500: server error')
  })

  it('assertOk returns ok responses', async () => {
    const response = new Response('ok', {status: 200})
    const result = await assertOk(response)

    expect(result).to.equal(response)
  })

  it('assertOk throws HttpError for failed responses', async () => {
    const response = new Response('nope', {status: 404, statusText: 'Not Found'})

    try {
      await assertOk(response)
      expect.fail('expected assertOk to throw')
    } catch (error) {
      expect(error).to.be.instanceOf(HttpError)
      expect((error as HttpError).status).to.equal(404)
      expect((error as HttpError).body).to.equal('nope')
    }
  })

  it('assertOk uses an empty body in the default error message', async () => {
    const response = new Response('', {status: 403, statusText: 'Forbidden'})

    try {
      await assertOk(response)
      expect.fail('expected assertOk to throw')
    } catch (error) {
      expect((error as HttpError).message).to.equal('HTTP 403: ')
    }
  })
})
