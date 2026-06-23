import { httpRequest } from './http'
import { tenantOrigin } from './plm.url'
import { normalizeFusionManageApiReferenceToPath } from '../shared/url/parse'

export function sortArray(array: Array<Record<string, any>>, key: string, type = 'string'): void {
  if (type.toLowerCase() === 'string') {
    array.sort(function (a, b) {
      const valueA = String(a[key]).toLowerCase()
      const valueB = String(b[key]).toLowerCase()
      if (valueA < valueB) return -1
      if (valueA > valueB) return 1
      return 0
    })
  } else {
    array.sort(function (a, b) {
      const valueA = a[key]
      const valueB = b[key]
      if (valueA < valueB) return -1
      if (valueA > valueB) return 1
      return 0
    })
  }
}

export async function genTableauColumms({
  tenant,
  wsId,
  columns,
  filters,
  headers
}: {
  tenant: string
  wsId: string | number
  columns?: Array<string | Record<string, any>>
  filters?: Array<Record<string, any>>
  headers?: Record<string, string>
}): Promise<Array<Record<string, any>> | Array<string | Record<string, any>>> {
  if (!tenant) {
    throw new Error('tenant is required')
  }

  const origin = tenantOrigin(tenant)
  const urlFields = `${origin}/api/v3/workspaces/${wsId}/fields`
  const urlGrid = `${origin}/api/v3/workspaces/${wsId}/views/13/fields`

  const requests = [
    httpRequest({ method: 'GET', url: urlFields, headers })
  ]

  const resolvedColumns = typeof columns === 'undefined'
    ? ['descriptor', 'created_on', 'last_modified_on']
    : columns

  const resolvedFilters = typeof filters === 'undefined' ? [] : filters

  const result: Array<Record<string, any>> = []
  let reuse = true
  let index = 0

  for (const column of resolvedColumns) {
    if (typeof column === 'string') {
      reuse = false
      if (column.toLowerCase().indexOf('grid.') === 0) {
        requests.push(
          httpRequest({ method: 'GET', url: urlGrid, headers })
        )
      }
    }
  }

  if (reuse) {
    return resolvedColumns
  }

  const responses = await Promise.all(requests)

  let allFields: any[] = []

  for (const response of responses) {
    allFields = allFields.concat(response.data.fields)
  }

  for (const column of resolvedColumns) {
    const col: Record<string, any> = {
      displayOrder: index++,
      field: {},
      group: {}
    }

    switch (String(column).toLowerCase()) {
      case 'descriptor':
        col.field.title = 'Item Descriptor'
        col.field.__self__ = `/api/v3/workspaces/${wsId}/views/0/fields/DESCRIPTOR`
        col.field.urn = ''
        col.field.type = { link: '/api/v3/field-types/4' }
        col.group = { label: 'ITEM_DESCRIPTOR_FIELD' }
        break

      case 'created_on':
        col.field.title = 'Created On'
        col.field.__self__ = `/api/v3/workspaces/${wsId}/views/0/fields/CREATED_ON`
        col.field.urn = ''
        col.field.type = { link: '/api/v3/field-types/3' }
        col.group = { label: 'LOG_FIELD' }
        break

      case 'last_modified_on':
        col.field.title = 'Last Modified On'
        col.field.__self__ = `/api/v3/workspaces/${wsId}/views/0/fields/LAST_MODIFIED_ON`
        col.field.urn = ''
        col.field.type = { link: '/api/v3/field-types/3' }
        col.group = { label: 'LOG_FIELD' }
        break

      case 'wf_current_state':
        col.field.title = 'Currrent State'
        col.field.__self__ = `/api/v3/workspaces/${wsId}/views/0/fields/WF_CURRENT_STATE`
        col.field.urn = ''
        col.field.type = { link: '/api/v3/field-types/3' }
        col.group = { label: 'WORKFLOW_FIELD' }
        break

      default: {
        let columnView = '1'
        let columnField = column
        let columnGroup = 'ITEM_DETAILS_FIELD'

        if (String(columnField).toLowerCase().indexOf('grid.') === 0) {
          columnView = '13'
          columnField = String(columnField).split('grid.')[1] ?? ''
          columnGroup = 'GRID_FIELD'
        }

        for (const field of allFields) {
          const viewId = field.__self__.split('/')[6]
          const fieldId = field.__self__.split('/')[8]

          if (viewId === columnView && fieldId === columnField) {
            col.field.title = field.name
            col.field.__self__ = field.__self__
            col.field.urn = ''
            col.field.type = { link: field.type.link }
            col.group = { label: columnGroup }

            for (const filter of resolvedFilters) {
              if (filter.fieldId === fieldId) {
                const matchRule = typeof filter.match === 'undefined' ? 'ALL' : filter.match

                col.appliedFilters = {
                  matchRule,
                  filters: []
                }

                for (const condition of filter.filters) {
                  col.appliedFilters.filters.push({
                    type: '/api/v3/filter-types/15',
                    value: condition[1]
                  })
                }
              }
            }
          }
        }
        break
      }
    }

    result.push(col)
  }

  return result
}

export function buildGridRowPayload({
  tenant,
  workspaceId,
  viewId = 13,
  data
}: {
  tenant?: string
  workspaceId: string | number
  viewId?: string | number
  data: Array<Record<string, any>>
}): Array<Record<string, any>> {
  if (!workspaceId) {
    throw new Error('workspaceId is required to build grid row payload')
  }

  if (!Array.isArray(data)) {
    throw new Error('data must be an array')
  }

  return data
    .map((field) => ({
      ...buildGridRowFieldDescriptor({
        tenant,
        workspaceId,
        viewId,
        field
      }),
      value: normalizeFieldValue(field, tenant)
    }))
    .filter((field) => field.value !== undefined)
}

function buildGridRowFieldDescriptor({
  tenant,
  workspaceId,
  viewId,
  field
}: {
  tenant?: string
  workspaceId: string | number
  viewId: string | number
  field: Record<string, any>
}): Record<string, any> {
  const normalizedTenant = String(tenant || '').trim().toUpperCase()
  const fieldId = String(field.fieldId || '').trim()
  const typeId = Number.isFinite(Number(field.typeId))
    ? Number(field.typeId)
    : Number.parseInt(String(field.typeLink || '').split('/').pop() || '', 10)

  const descriptor: Record<string, any> = {
    __self__: field.fieldSelf || `/api/v3/workspaces/${workspaceId}/views/${viewId}/fields/${fieldId}`
  }

  const fieldUrn = String(field.fieldUrn || '').trim()
  if (fieldUrn) {
    descriptor.urn = fieldUrn
  } else if (normalizedTenant && fieldId) {
    descriptor.urn = `urn:adsk.plm:tenant.workspace.view.field:${normalizedTenant}.${workspaceId}.${viewId}.${fieldId}`
  }

  const title = String(field.typeTitle || field.title || '').trim()
  if (title) descriptor.title = title

  const typeLink = String(field.typeLink || '').trim()
  const typeUrn = String(field.typeUrn || '').trim()
  const typeTitle = String(field.typeTitle || '').trim()
  if (typeLink || typeUrn || typeTitle || Number.isFinite(typeId)) {
    descriptor.type = {
      deleted: false
    }
    if (typeLink) {
      descriptor.type.link = typeLink
    } else if (Number.isFinite(typeId)) {
      descriptor.type.link = `/api/v3/field-types/${typeId}`
    }
    if (typeUrn) {
      descriptor.type.urn = typeUrn
    } else if (normalizedTenant && Number.isFinite(typeId)) {
      descriptor.type.urn = `urn:adsk.plm:tenant.field-type:${normalizedTenant}.${typeId}`
    }
    if (typeTitle) descriptor.type.title = typeTitle
  }

  return descriptor
}

export function buildItemSectionsPayload({
  prefix,
  sections,
  fields,
  derived
}: {
  prefix: string
  sections: Array<Record<string, any>>
  fields?: Array<Record<string, any>>
  derived?: { sections?: Array<Record<string, any>> }
}): Array<Record<string, any>> {
  if (!fields) {
    return parseSectionPayload(sections, prefix)
  }

  const payloadSections: Array<Record<string, any>> = []

  for (const field of fields) {
    const section = findFieldSection(sections, field)
    if (!section) continue

    const sectionId = section.__self__.split('/').pop()

    const fieldData = {
      __self__: `${prefix}/views/1/fields/${field.fieldId}`,
      value: normalizeFieldValue(field)
    }

    addPayloadSectionField(
      payloadSections,
      prefix,
      sectionId,
      fieldData
    )
  }

  if (derived?.sections) {
    for (const derivedSection of derived.sections) {
      const sectionId = derivedSection.link.split('/').pop()

      for (const field of derivedSection.fields) {
        addPayloadSectionField(
          payloadSections,
          prefix,
          sectionId,
          field
        )
      }
    }
  }

  return payloadSections
}

function addPayloadSectionField(
  sections: Array<Record<string, any>>,
  prefix: string,
  sectionId: string,
  fieldData: Record<string, any>
): void {
  const sectionLink = `${prefix}/sections/${sectionId}`

  let section = sections.find((entry) => entry.link === sectionLink)

  if (!section) {
    section = {
      link: sectionLink,
      fields: []
    }
    sections.push(section)
  }

  section.fields.push(fieldData)
}

function findFieldSection(sections: Array<Record<string, any>>, field: Record<string, any>): Record<string, any> | null {
  for (const section of sections) {
    for (const sectionField of section.fields) {
      if (
        field.fieldId === sectionField.link?.split('/').pop()
        || field.link === sectionField.link
      ) {
        return section
      }

      if (sectionField.type === 'MATRIX') {
        for (const matrix of section.matrices || []) {
          for (const row of matrix.fields || []) {
            for (const matrixField of row) {
              if (!matrixField) continue

              const id = matrixField.link?.split('/').pop()

              if (id === field.fieldId) {
                return section
              }
            }
          }
        }
      }
    }
  }

  return null
}

/**
 * Resolves a picklist / link field value (path, URL, or URN string) to a canonical `/api/v3/...` path.
 */
function resolveLookupFieldValueToApiPath(fieldValue: string): string {
  const t = String(fieldValue || '').trim()
  if (!t) return ''
  const fromNorm = normalizeFusionManageApiReferenceToPath(t) || (t.startsWith('/api/v3/') ? t : '')
  if (fromNorm) return fromNorm
  if (!t.toLowerCase().startsWith('urn:')) return ''

  const workspaceItem = /^urn:adsk\.plm:tenant\.workspace\.item:(.+)$/i.exec(t)
  if (workspaceItem) {
    const segments = (workspaceItem[1] ?? '').split('.')
    if (segments.length >= 3) {
      const ws = segments[segments.length - 2] ?? ''
      const id = segments[segments.length - 1] ?? ''
      if (/^\d+$/.test(ws) && /^\d+$/.test(id)) {
        return `/api/v3/workspaces/${ws}/items/${id}`
      }
    }
  }

  const lookupOption = /^urn:adsk\.plm:tenant\.lookup\.option:(.+)\.(\d+)$/i.exec(t)
  if (lookupOption) {
    const rest = lookupOption[1] ?? ''
    const optionId = lookupOption[2] ?? ''
    const firstDot = rest.indexOf('.')
    if (firstDot > 0 && /^\d+$/.test(optionId)) {
      const lookupId = rest.slice(firstDot + 1)
      if (lookupId) return `/api/v3/lookups/${lookupId}/options/${optionId}`
    }
  }

  return ''
}

/**
 * Derives the Fusion value URN from a self link when the API expects it (workspace items; radio picklist options).
 */
function deriveFusionValueUrn(
  tenantUpper: string | undefined,
  apiLink: string,
  payloadType?: string
): string | undefined {
  const tenant = String(tenantUpper || '').trim().toUpperCase()
  const link = String(apiLink || '').trim()
  if (!tenant || !link) return undefined

  const normalizedPayload = String(payloadType || '').trim().toLowerCase()

  const item = /^\/api\/v3\/workspaces\/(\d+)\/items\/(\d+)$/i.exec(link)
  if (item) {
    return `urn:adsk.plm:tenant.workspace.item:${tenant}.${item[1]}.${item[2]}`
  }

  const lookupOpt = /^\/api\/v3\/lookups\/([^/]+)\/options\/(\d+)$/i.exec(link)
  if (lookupOpt && normalizedPayload === 'radio') {
    return `urn:adsk.plm:tenant.lookup.option:${tenant}.${lookupOpt[1]}.${lookupOpt[2]}`
  }

  return undefined
}

function buildGridLookupValueObject(
  apiLink: string,
  displayTitle: string,
  tenantUpper: string | undefined,
  payloadType: string,
  explicitUrn?: string | null
): Record<string, any> {
  const link = String(apiLink || '').trim()
  const title = String(displayTitle || '').trim()
  const out: Record<string, any> = {}
  if (/^\/api\/v3\//i.test(link)) {
    out.link = link
  }
  if (title) out.title = title
  const urn =
    String(explicitUrn || '').trim() ||
    (/^\/api\/v3\//i.test(link) ? deriveFusionValueUrn(tenantUpper, link, payloadType) : undefined)
  if (urn) {
    out.urn = urn
    out.deleted = false
  }
  return out
}

function normalizeFieldValue(field: Record<string, any>, tenant?: string): any {
  const value = field.value
  const display = field.display
  const type = String(field.type || 'string').toLowerCase()
  const tenantUpper = String(tenant || '').trim().toUpperCase() || undefined
  const explicitValueUrn =
    typeof field.valueUrn === 'string' && field.valueUrn.trim() ? field.valueUrn.trim() : undefined

  if (typeof value === 'string' && !value.includes(',')) {
    const trimmed = value.trim()
    const linkPath =
      normalizeFusionManageApiReferenceToPath(value) ||
      (trimmed.startsWith('/api/v3/') ? trimmed : '') ||
      resolveLookupFieldValueToApiPath(trimmed)
    if (linkPath) {
      return buildGridLookupValueObject(linkPath, String(display || '').trim(), tenantUpper, type, explicitValueUrn)
    }
  }

  if (type === 'multi-select') {
    const values = Array.isArray(value)
      ? value
      : String(value || '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
    if (values.length === 0) return null

    const labels = Array.isArray(display)
      ? display
      : String(display || '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)

    const valueUrnsByEntry =
      typeof field.valueUrn === 'string' && field.valueUrn.trim()
        ? String(field.valueUrn)
          .split(',')
          .map((entry) => entry.trim())
        : []

    const mapped = values
      .map((entry, index) => {
        if (entry && typeof entry === 'object') {
          const obj = { ...(entry as Record<string, any>) }
          if (!obj.title && labels[index]) obj.title = labels[index]
          if (obj.urn != null && String(obj.urn).trim() && obj.deleted === undefined) obj.deleted = false
          return obj
        }
        const entryFieldValue = String(entry || '').trim()
        const linkPath =
          normalizeFusionManageApiReferenceToPath(entryFieldValue) ||
          (entryFieldValue.startsWith('/api/v3/') ? entryFieldValue : '') ||
          resolveLookupFieldValueToApiPath(entryFieldValue)
        const label = labels[index] || ''
        const perUrn = valueUrnsByEntry[index]
        if (linkPath) {
          return buildGridLookupValueObject(linkPath, label, tenantUpper, 'multi-select', perUrn)
        }
        if (perUrn) {
          const item: Record<string, any> = { urn: perUrn, deleted: false }
          if (label) item.title = label
          return item
        }
        if (label) return { title: label }
        return null
      })
      .filter((entry): entry is Record<string, any> => entry != null)
    return mapped.length > 0 ? mapped : null
  }

  switch (type) {
    case 'integer':
      return value === '' ? null : parseInt(value, 10)

    case 'number':
    case 'decimal':
    case 'money': {
      if (value === '' || value == null) return null
      const normalized = String(value).trim().replace(/\s+/g, '').replace(/,/g, '').replace(/[^\d.\-]/g, '')
      if (!normalized || normalized === '-' || normalized === '.' || normalized === '-.') return null
      const parsed = Number(normalized)
      return Number.isFinite(parsed) ? parsed : null
    }

    case 'radio':
    case 'single-select':
    case 'buom':
      if (value === null || value === undefined || value === '') return null
      if (typeof value === 'object') {
        const o = { ...(value as Record<string, unknown>) } as Record<string, any>
        if (typeof o.link === 'string' && o.link.trim()) {
          const rawLink = o.link.trim()
          const normalizedLink =
            normalizeFusionManageApiReferenceToPath(rawLink) ||
            (rawLink.startsWith('/api/v3/') ? rawLink : '') ||
            resolveLookupFieldValueToApiPath(rawLink)
          if (normalizedLink) o.link = normalizedLink
          else delete o.link
        }
        const urnStr = String(o.urn || '').trim()
        if ((typeof o.link !== 'string' || !o.link.trim()) && urnStr) {
          const recovered = resolveLookupFieldValueToApiPath(urnStr)
          if (recovered) o.link = recovered
        }
        if (typeof o.link === 'string' && !o.link.trim()) delete o.link
        if (!o.title && String(display || '').trim()) o.title = String(display || '').trim()
        if (!o.urn && typeof o.link === 'string') {
          const derived = explicitValueUrn || deriveFusionValueUrn(tenantUpper, String(o.link), type)
          if (derived) {
            o.urn = derived
            o.deleted = false
          }
        } else if (o.urn != null && String(o.urn).trim() && o.deleted === undefined) {
          o.deleted = false
        }
        return o
      }
      {
        const fieldValue = String(value).trim()
        if (!fieldValue) return null
        let linkPath =
          normalizeFusionManageApiReferenceToPath(fieldValue) ||
          (fieldValue.startsWith('/api/v3/') ? fieldValue : '')
        if (!linkPath) linkPath = resolveLookupFieldValueToApiPath(fieldValue)
        if (!linkPath) linkPath = resolveLookupFieldValueToApiPath(String(display || '').trim())
        if (linkPath) {
          return buildGridLookupValueObject(linkPath, String(display || '').trim(), tenantUpper, type, explicitValueUrn)
        }
        const titleOnly = String(display || '').trim()
        if (explicitValueUrn) {
          const out: Record<string, any> = { urn: explicitValueUrn, deleted: false }
          if (titleOnly) out.title = titleOnly
          return out
        }
        if (titleOnly) return { title: titleOnly }
        return null
      }

    default:
      return value === '' ? null : value
  }
}

function parseSectionPayload(sections: Array<Record<string, any>>, prefix: string): Array<Record<string, any>> {
  const payload: Array<Record<string, any>> = []

  for (const section of sections) {
    const sectionId = section.id || section.link.split('/').pop()

    const fields: Array<Record<string, any>> = []
    for (const field of section.fields) {
      fields.push({
        __self__: `${prefix}/views/1/fields/${field.fieldId}`,
        value: normalizeFieldValue(field)
      })
    }

    payload.push({
      link: `${prefix}/sections/${sectionId}`,
      fields
    })
  }

  return payload
}
