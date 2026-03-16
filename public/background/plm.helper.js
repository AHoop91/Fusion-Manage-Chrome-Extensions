/**
 * Sort an array of objects by a given key.
 * Legacy helper ported from server implementation.
 *
 * Behaviour:
 * - Mutates the input array in place
 * - Uses simple < / > comparison (no localeCompare)
 * - Supports string and non-string sorting
 *
 * @param {Array<Object>} array   Array to sort (mutated in place)
 * @param {string} key            Object key to sort by
 * @param {string=} type          Sort type ('string' or other)
 */
export function sortArray(array, key, type) {

    if (typeof type === 'undefined') type = 'string';

    if (type.toLowerCase() === 'string') {

        array.sort(function (a, b) {
            var valueA = String(a[key]).toLowerCase();
            var valueB = String(b[key]).toLowerCase();
            if (valueA < valueB) return -1;
            if (valueA > valueB) return 1;
            return 0;
        });

    } else {

        array.sort(function (a, b) {
            var valueA = a[key];
            var valueB = b[key];
            if (valueA < valueB) return -1;
            if (valueA > valueB) return 1;
            return 0;
        });

    }
}

/**
 * GENERATE TABLEAU COLUMNS
 *
 * Equivalent of genTableauColumms(req, headers, callback)
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number} params.wsId
 * @param {Array<string|Object>=} params.columns
 * @param {Array<Object>=} params.filters
 * @param {Object=} params.headers
 *
 * @returns {Array<Object>|Array<string>}
 */
export async function genTableauColumms({
    tenant,
    wsId,
    columns,
    filters,
    headers
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    const urlFields = `https://${tenant}.autodeskplm360.net/api/v3/workspaces/${wsId}/fields`;
    const urlGrid = `https://${tenant}.autodeskplm360.net/api/v3/workspaces/${wsId}/views/13/fields`;

    let requests = [
        httpRequest({ method: 'GET', url: urlFields, headers })
    ];

    let resolvedColumns =
        (typeof columns === 'undefined')
            ? ['descriptor', 'created_on', 'last_modified_on']
            : columns;

    let resolvedFilters =
        (typeof filters === 'undefined') ? [] : filters;

    let result = [];
    let reuse = true;
    let index = 0;

    for (let column of resolvedColumns) {
        if (typeof column === 'string') {
            reuse = false;
            if (column.toLowerCase().indexOf('grid.') === 0) {
                requests.push(
                    httpRequest({ method: 'GET', url: urlGrid, headers })
                );
            }
        }
    }

    if (reuse) {
        return resolvedColumns;
    }

    const responses = await Promise.all(requests);

    let allFields = [];

    for (let response of responses) {
        allFields = allFields.concat(response.data.fields);
    }

    for (let column of resolvedColumns) {
        let col = {
            displayOrder: index++,
            field: {},
            group: {}
        };

        switch (column.toLowerCase()) {
            case 'descriptor':
                col.field.title = 'Item Descriptor';
                col.field.__self__ = '/api/v3/workspaces/' + wsId + '/views/0/fields/DESCRIPTOR';
                col.field.urn = '';
                col.field.type = { link: '/api/v3/field-types/4' };
                col.group = { label: 'ITEM_DESCRIPTOR_FIELD' };
                break;

            case 'created_on':
                col.field.title = 'Created On';
                col.field.__self__ = '/api/v3/workspaces/' + wsId + '/views/0/fields/CREATED_ON';
                col.field.urn = '';
                col.field.type = { link: '/api/v3/field-types/3' };
                col.group = { label: 'LOG_FIELD' };
                break;

            case 'last_modified_on':
                col.field.title = 'Last Modified On';
                col.field.__self__ = '/api/v3/workspaces/' + wsId + '/views/0/fields/LAST_MODIFIED_ON';
                col.field.urn = '';
                col.field.type = { link: '/api/v3/field-types/3' };
                col.group = { label: 'LOG_FIELD' };
                break;

            case 'wf_current_state':
                col.field.title = 'Currrent State';
                col.field.__self__ = '/api/v3/workspaces/' + wsId + '/views/0/fields/WF_CURRENT_STATE';
                col.field.urn = '';
                col.field.type = { link: '/api/v3/field-types/3' };
                col.group = { label: 'WORKFLOW_FIELD' };
                break;

            default:
                let columnView = '1';
                let columnField = column;
                let columnGroup = 'ITEM_DETAILS_FIELD';

                if (columnField.toLowerCase().indexOf('grid.') === 0) {
                    columnView = '13';
                    columnField = columnField.split('grid.')[1];
                    columnGroup = 'GRID_FIELD';
                }

                for (let field of allFields) {

                    let viewId = field.__self__.split('/')[6];
                    let fieldId = field.__self__.split('/')[8];

                    if (viewId === columnView) {
                        if (fieldId === columnField) {
                            col.field.title = field.name;
                            col.field.__self__ = field.__self__;
                            col.field.urn = '';
                            col.field.type = { link: field.type.link };
                            col.group = { label: columnGroup };

                            for (let filter of resolvedFilters) {

                                if (filter.fieldId === fieldId) {

                                    let matchRule =
                                        (typeof filter.match === 'undefined') ? 'ALL' : filter.match;

                                    col.appliedFilters = {
                                        matchRule: matchRule,
                                        filters: []
                                    };

                                    for (let condition of filter.filters) {
                                        col.appliedFilters.filters.push({
                                            type: '/api/v3/filter-types/15',
                                            value: condition[1]
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
                break;
        }

        result.push(col);
    }

    return result;
}

/**
 * Build payload for adding a grid (view 13) row.
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number} params.workspaceId
 * @param {number=} params.viewId
 * @param {Array} params.data
 *
 * @returns {Array} rowData payload
 */
export function buildGridRowPayload({ tenant, workspaceId, viewId = 13, data }) {
    if (!workspaceId) {
        throw new Error('workspaceId is required to build grid row payload');
    }

    if (!Array.isArray(data)) {
        throw new Error('data must be an array');
    }

    return data.map((field) => ({
        ...buildGridRowFieldDescriptor({
            tenant,
            workspaceId,
            viewId,
            field
        }),
        value: normalizeFieldValue(field)
    }))
    .filter((field) => field.value !== undefined);
}

function buildGridRowFieldDescriptor({
    tenant,
    workspaceId,
    viewId,
    field
}) {
    const normalizedTenant = String(tenant || '').trim().toUpperCase();
    const fieldId = String(field.fieldId || '').trim();
    const typeId =
        Number.isFinite(Number(field.typeId))
            ? Number(field.typeId)
            : Number.parseInt(String(field.typeLink || '').split('/').pop() || '', 10);

    const descriptor = {
        __self__: field.fieldSelf || `/api/v3/workspaces/${workspaceId}/views/${viewId}/fields/${fieldId}`
    };

    const fieldUrn = String(field.fieldUrn || '').trim();
    if (fieldUrn) {
        descriptor.urn = fieldUrn;
    } else if (normalizedTenant && fieldId) {
        descriptor.urn = `urn:adsk.plm:tenant.workspace.view.field:${normalizedTenant}.${workspaceId}.${viewId}.${fieldId}`;
    }

    const title = String(field.typeTitle || field.title || '').trim();
    if (title) descriptor.title = title;

    const typeLink = String(field.typeLink || '').trim();
    const typeUrn = String(field.typeUrn || '').trim();
    const typeTitle = String(field.typeTitle || '').trim();
    if (typeLink || typeUrn || typeTitle || Number.isFinite(typeId)) {
        descriptor.type = {
            deleted: false
        };
        if (typeLink) {
            descriptor.type.link = typeLink;
        } else if (Number.isFinite(typeId)) {
            descriptor.type.link = `/api/v3/field-types/${typeId}`;
        }
        if (typeUrn) {
            descriptor.type.urn = typeUrn;
        } else if (normalizedTenant && Number.isFinite(typeId)) {
            descriptor.type.urn = `urn:adsk.plm:tenant.field-type:${normalizedTenant}.${typeId}`;
        }
        if (typeTitle) descriptor.type.title = typeTitle;
    }

    return descriptor;
}

/**
 * Build APS sections payload for item creation.
 *
 * @param {Object} params
 * @param {string} params.prefix    // /api/v3/workspaces/{wsId}
 * @param {Array=} params.sections  // Workspace sections metadata
 * @param {Array=} params.fields    // Flat list of field values
 * @param {Object=} params.derived  // Derived section payload
 *
 * @returns {Array} APS sections payload
 */
export function buildItemSectionsPayload({
   prefix,
   sections,
   fields,
   derived
}) {
    if (!fields) {
        return parseSectionPayload(sections, prefix);
    }

    const payloadSections = [];

    for (const field of fields) {
        const section = findFieldSection(sections, field);
        if (!section) continue;

        const sectionId = section.__self__.split('/').pop();

        const fieldData = {
            __self__: `${prefix}/views/1/fields/${field.fieldId}`,
            value: normalizeFieldValue(field)
        };

        addPayloadSectionField(
            payloadSections,
            prefix,
            sectionId,
            fieldData
        );
    }

    if (derived?.sections) {
        for (const derivedSection of derived.sections) {
            const sectionId = derivedSection.link.split('/').pop();

            for (const field of derivedSection.fields) {
                addPayloadSectionField(
                    payloadSections,
                    prefix,
                    sectionId,
                    field
                );
            }
        }
    }

    return payloadSections;
}

function addPayloadSectionField(
    sections,
    prefix,
    sectionId,
    fieldData
) {
    const sectionLink = `${prefix}/sections/${sectionId}`;

    let section = sections.find(s => s.link === sectionLink);

    if (!section) {
        section = {
            link: sectionLink,
            fields: []
        };
        sections.push(section);
    }

    section.fields.push(fieldData);
}

function findFieldSection(sections, field) {
    for (const section of sections) {
        for (const sectionField of section.fields) {
            if (
                field.fieldId === sectionField.link?.split('/').pop() ||
                field.link === sectionField.link
            ) {
                return section;
            }

            if (sectionField.type === 'MATRIX') {
                for (const matrix of section.matrices || []) {
                    for (const row of matrix.fields || []) {
                        for (const matrixField of row) {
                            if (!matrixField) continue;

                            const id =
                                matrixField.link
                                    ?.split('/')
                                    .pop();

                            if (id === field.fieldId) {
                                return section;
                            }
                        }
                    }
                }
            }
        }
    }

    return null;
}

function normalizeFieldValue(field) {
    let value = field.value;
    const display = field.display;
    const type = (field.type || 'string').toLowerCase();

    if (
        typeof value === 'string' &&
        value.startsWith('/api/v3/') &&
        !value.includes(',')
    ) {
        const lookup = { link: value };
        const title = String(display || '').trim();
        if (title) lookup.title = title;
        return lookup;
    }

    if (type === 'multi-select') {
        const values = Array.isArray(value)
            ? value
            : String(value || '')
                .split(',')
                .map(v => v.trim())
                .filter(Boolean);
        if (values.length === 0) return null;

        const labels = Array.isArray(display)
            ? display
            : String(display || '')
                .split(',')
                .map(v => v.trim())
                .filter(Boolean);

        return values.map((entry, index) => {
            if (entry && typeof entry === 'object') {
                const obj = { ...entry };
                if (!obj.title && labels[index]) obj.title = labels[index];
                return obj;
            }
            const link = String(entry || '').trim();
            const item = { link };
            if (labels[index]) item.title = labels[index];
            return item;
        });
    }

    switch (type) {
        case 'integer':
            return value === '' ? null : parseInt(value, 10);

        case 'number':
        case 'decimal':
        case 'money': {
            if (value === '' || value == null) return null;
            const normalized = String(value).trim().replace(/\s+/g, '').replace(/,/g, '').replace(/[^\d.\-]/g, '');
            if (!normalized || normalized === '-' || normalized === '.' || normalized === '-.') return null;
            const parsed = Number(normalized);
            return Number.isFinite(parsed) ? parsed : null;
        }

        case 'radio':
        case 'single-select':
        case 'buom':
            if (!value) return null;
            if (typeof value === 'object') return value;
            {
                const selected = { link: String(value).trim() };
                const selectedTitle = String(display || '').trim();
                if (selectedTitle) selected.title = selectedTitle;
                return selected;
            }

        default:
            return value === '' ? null : value;
    }
}

function parseSectionPayload(sections, prefix) {
    const payload = [];

    for (const section of sections) {
        const sectionId =
            section.id ||
            section.link.split('/').pop();

        const sect = {
            link: `${prefix}/sections/${sectionId}`,
            fields: []
        };

        for (const field of section.fields) {
            sect.fields.push({
                __self__: `${prefix}/views/1/fields/${field.fieldId}`,
                value: normalizeFieldValue(field)
            });
        }

        payload.push(sect);
    }

    return payload;
}
