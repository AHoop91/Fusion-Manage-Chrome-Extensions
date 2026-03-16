import { httpRequest, httpRequestWithMeta, httpMultipartRequest, httpBinaryRequest, httpBinaryRequestWithMeta } from './http.js';
import { sortArray, genTableauColumms, buildGridRowPayload, buildItemSectionsPayload } from "./plm.helper.js";

const APS_BASE = (tenant) => `https://${tenant}.autodeskplm360.net`;

/**
 * Fetch workspace tabs.
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.workspaceId
 * @param {string=} params.link
 */
export async function fetchTabs({ tenant, workspaceId }) {
    const url = `${APS_BASE(tenant)}/api/v3/workspaces/${workspaceId}/tabs`;

    return httpRequest({
        method: 'GET',
        url
    });
}

/**
 * Fetch workspace sections.
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.workspaceId
 * @param {string=} params.link
 */
export async function fetchSections({
    tenant,
    workspaceId,
    link
}) {
    let wsId = workspaceId;

    if (!wsId && link) {
        const parts = link.split('/');
        wsId = Number(parts[4]);
    }

    if (!wsId) {
        throw new Error('workspaceId is required');
    }

    const url = `${APS_BASE(tenant)}/api/v3/workspaces/${wsId}/sections`;

    return httpRequest({
        method: 'GET',
        url,
        headers: {
            Accept: 'application/vnd.autodesk.plm.sections.bulk+json'
        }
    });
}

/**
 * Fetch workspace fields.
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.workspaceId
 * @param {string=} params.link
 */
export async function fetchFields({
    tenant,
    workspaceId,
    link
}) {
    let wsId = workspaceId;

    if (!wsId && link) {
        const parts = link.split('/');
        wsId = Number(parts[4]);
    }

    if (!wsId) {
        throw new Error('workspaceId is required');
    }

    const url = `${APS_BASE(tenant)}/api/v3/workspaces/${wsId}/fields`;

    const response = await httpRequest({
        method: 'GET',
        url
    });

    return response?.fields ?? [];
}

/**
 * Fetch all picklists.
 *
 * @param {Object} params
 * @param {string} params.tenant
 */
export async function fetchPicklists({ tenant }) {
    const url = `${APS_BASE(tenant)}/api/rest/v1/setups/picklists`;

    let data = await httpRequest({
        method: 'GET',
        url
    });

    if (data === '') {
        data = { items: [] };
    }

    return data;
}

/**
 * Fetch a picklist definition.
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {string|number=} params.id
 * @param {string=} params.link
 */
export async function fetchPicklistDefinition({
    tenant,
    id,
    link
}) {
    let picklistId = id;

    if (!picklistId && link) {
        picklistId = link.split('/').pop();
    }

    if (!picklistId) {
        throw new Error('picklist id is required');
    }

    const url = `${APS_BASE(tenant)}/api/rest/v1/setups/picklists/${picklistId}`;

    let data = await httpRequest({
        method: 'GET',
        url
    });

    if (data === '') {
        data = { items: [] };
    }

    return data;
}

/**
 * Fetch picklist items.
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {string} params.link
 * @param {number=} params.limit
 * @param {number=} params.offset
 * @param {string=} params.filter
 */
export async function fetchPicklist({
    tenant,
    link,
    limit = 100,
    offset = 0,
    filter = ''
}) {
    if (!link) {
        throw new Error('picklist link is required');
    }

    const query = new URLSearchParams({
        asc: 'title',
        limit: String(limit),
        offset: String(offset),
        filter
    });

    const url = `${APS_BASE(tenant)}${link}?${query.toString()}`;

    let data = await httpRequest({
        method: 'GET',
        url
    });

    if (data === '') {
        data = { items: [] };
    }

    return data;
}

/**
 * Fetch filtered picklist options.
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {string} params.link
 * @param {Array<[string, string]>} params.filters
 * @param {number=} params.limit
 * @param {number=} params.offset
 */
export async function fetchFilteredPicklist({
    tenant,
    link,
    filters = [],
    limit = 100,
    offset = 0
}) {
    if (!link) {
        throw new Error('picklist link is required');
    }

    const queryParts = [];

    for (const [key, value] of filters) {
        queryParts.push(
            `${key}=${String(value).replace(/ /g, '+')}`
        );
    }

    queryParts.push(`limit=${limit}`);
    queryParts.push(`offset=${offset}`);
    queryParts.push('filter=');

    const url = `${APS_BASE(tenant)}${link}/options?${queryParts.join('&')}`;

    let data = await httpRequest({
        method: 'GET',
        url
    });

    if (data === '') {
        data = { items: [] };
    }

    return data;
}

/**
 * Fetch related workspaces for a workspace/view.
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number} params.workspaceId
 * @param {number|string} params.view
 */
export async function fetchRelatedWorkspaces({
     tenant,
     workspaceId,
     view
 }) {
    if (!workspaceId) {
        throw new Error('workspaceId is required');
    }

    if (view === undefined || view === null) {
        throw new Error('view is required');
    }

    const url = `${APS_BASE(tenant)}/api/v3/workspaces/${workspaceId}/views/${view}/related-workspaces`;

    const data = await httpRequest({
        method: 'GET',
        url
    });

    return Array.isArray(data?.workspaces) ? data.workspaces : [];
}

/**
 * Fetch linked (managing / linked-to) workspaces.
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.workspaceId
 * @param {string=} params.link
 */
export async function fetchLinkedWorkspaces({
    tenant,
    workspaceId,
    link
}) {
    let wsId = workspaceId;

    if (!wsId && link) {
        const parts = link.split('/');
        wsId = Number(parts[4]);
    }

    if (!wsId) {
        throw new Error('workspaceId is required');
    }

    const url = `${APS_BASE(tenant)}/api/v3/workspaces/${wsId}/views/11/linkedto-workspaces`;

    const data = await httpRequest({
        method: 'GET',
        url
    });

    return Array.isArray(data?.workspaces) ? data.workspaces : [];
}

/**
 * Create a new item in Fusion Manage.
 *
 * Workflow:
 * 1. Build APS sections/fields payload
 * 2. POST item creation
 * 3. Optional image upload
 * 4. Optional full item fetch
 */
export async function createItem({
                                     tenant,
                                     workspaceId,
                                     sections,
                                     fields,
                                     derived,
                                     image,
                                     getDetails = false
                                 }) {
    if (!tenant) throw new Error('tenant is required');
    if (!workspaceId) throw new Error('workspaceId is required');

    const prefix  = `/api/v3/workspaces/${workspaceId}`;

    const payloadSections = buildItemSectionsPayload({
        prefix,
        sections,
        fields,
        derived
    });

    const createResponseMeta = await httpRequestWithMeta({
        method: 'POST',
        url: `${APS_BASE(tenant)}${prefix}/items`,
        body: { sections: payloadSections }
    });
    const createResponse = createResponseMeta?.data;
    const locationHeader = String(createResponseMeta?.headers?.location || '').trim();

    const itemPath = locationHeader
        || createResponse?.__self__
        || createResponse?.location
        || createResponse?.data;

    if (!itemPath) {
        throw new Error('Item creation did not return item location');
    }

    const itemUrl = itemPath.startsWith('http') ? itemPath : `${APS_BASE(tenant)}${itemPath}`;

    if (image) {
        await uploadItemImage({ itemUrl, image });
    }

    if (getDetails) {
        return httpRequest({
            method: 'GET',
            url: itemUrl
        });
    }

    return { location: itemUrl };
}

/**
 * Upload an image to an existing item.
 *
 * This function performs the APS-required multipart upload workflow:
 *
 * 1. Fetch the current item detail JSON (required by APS)
 * 2. Convert a base64-encoded image into a binary Blob
 * 3. Construct a multipart/form-data payload containing:
 *    - the image file (keyed by fieldId)
 *    - the full itemDetail JSON
 * 4. Upload the payload via PUT to the item endpoint
 *
 * Design constraints:
 * - Runs only in the background context
 * - Does not handle authentication directly
 * - Does not perform UI logic or validation beyond basic checks
 * - Not suitable for bulk or automated uploads
 *
 * Important notes:
 * - The browser must manage multipart boundaries (do not set Content-Type)
 * - A 204 No Content response is considered a successful upload
 * - This operation has side effects and should not be retried blindly
 *
 * @param {Object} params
 * @param {string} params.itemUrl            - Absolute APS item URL
 * @param {Object} params.image
 * @param {string} params.image.fieldId      - Field ID for the image attribute
 * @param {string} params.image.value        - Base64 data URL of the image
 *
 * @throws {Error} When the image payload is invalid or the upload fails
 */
async function uploadItemImage({ itemUrl, image }) {
    if (!image?.fieldId || !image?.value) {
        throw new Error('Invalid image payload');
    }

    const itemDetail = await httpRequest({
        method: 'GET',
        url: itemUrl
    });

    const base64 = image.value.replace(/^data:image\/\w+;base64,/, '');
    const binary = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const blob = new Blob([binary], { type: 'application/octet-stream'});
    const formData = new FormData();
    formData.append(image.fieldId, blob);
    formData.append(
        'itemDetail',
        new Blob([JSON.stringify(itemDetail)], {
            type: 'application/json'
        })
    );

    await httpMultipartRequest({
        method: 'PUT',
        url: itemUrl,
        formData
    });
}

/**
 * Edit an existing item.
 *
 * Workflow:
 * 1. Resolve item URL (link OR workspaceId + dmsId)
 * 2. Build APS edit payload
 * 3. PATCH item
 * 4. Optional full item fetch
 */
export async function editItem({
    tenant,
    workspaceId,
    dmsId,
    link,
    sections,
    fields,
    derived,
    getDetails = false
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    let itemPath;

    if (link) {
        itemPath = link;
    } else {
        if (!workspaceId || !dmsId) {
            throw new Error('workspaceId and dmsId are required when link is not provided');
        }
        itemPath = `/api/v3/workspaces/${workspaceId}/items/${dmsId}`;
    }

    const itemUrl = itemPath.startsWith('http') ? itemPath : `${APS_BASE(tenant)}${itemPath}`;

    const payloadSections = buildItemSectionsPayload({
        prefix: itemPath,
        sections,
        fields,
        derived
    });

    await httpRequest({
        method: 'PATCH',
        url: itemUrl,
        body: {
            sections: payloadSections
        }
    });

    if (getDetails) {
        return httpRequest({
            method: 'GET',
            url: itemUrl
        });
    }

    return { location: itemUrl };
}

/**
 * Clone an existing item.
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {string} params.link              // Source item link
 * @param {Array}  params.sections          // Sections/fields to apply
 * @param {Array=} params.options           // Clone options
 */
export async function cloneItem({
    tenant,
    link,
    sections,
    options = ['ITEM_DETAILS']
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    if (!link) {
        throw new Error('source item link is required');
    }

    if (!Array.isArray(sections)) {
        throw new Error('sections must be an array');
    }

    const parts = link.split('/');
    const workspaceId  = parts[4];
    const sourceItemId = parts[6];

    if (!workspaceId || !sourceItemId) {
        throw new Error('Invalid item link');
    }

    const prefix  = `/api/v3/workspaces/${workspaceId}`;
    const payloadSections = sections.map(section => {
        const sectionId =
            section.id ||
            section.link?.split('/').pop();

        const sect = {
            link: section.link || `${prefix}/sections/${sectionId}`,
            fields: []
        };

        if (section.classificationId) {
            sect.classificationId = Number(section.classificationId);
        }

        for (const field of section.fields) {
            let value = field.value;
            const type = (field.type || 'string').toLowerCase();

            if (type === 'integer') {
                value = parseInt(value, 10);
            } else if (value === '') {
                value = null;
            }

            sect.fields.push({
                __self__: `${prefix}/views/1/fields/${field.fieldId}`,
                value,
                urn: `urn:adsk.plm:tenant.workspace.view.field:${tenant.toUpperCase()}.${workspaceId}.1.${field.fieldId}`,
                fieldMetadata: null,
                dataTypeId: Number(field.typeId),
                title: field.title
            });
        }

        return sect;
    });

    const clonePayload = {
        sourceItemId,
        cloneOptions: options,
        hasPivotFields: false,
        item: {
            sections: payloadSections
        }
    };

    const formData = new FormData();
    formData.append(
        'itemDetail',
        new Blob([JSON.stringify(clonePayload)], {
            type: 'application/json'
        })
    );

    await httpMultipartRequest({
        method: 'POST',
        url: `${APS_BASE(tenant)}${prefix}/items`,
        headers: {
            Accept: 'application/vnd.autodesk.plm.meta+json'
        },
        formData
    });

    return true;
}

/**
 * Archive (soft-delete) an item.
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.workspaceId
 * @param {number=} params.dmsId
 * @param {string=} params.link
 */
export async function archiveItem({
    tenant,
    workspaceId,
    dmsId,
    link
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    let itemPath;

    if (link) {
        itemPath = link;
    } else {
        if (!workspaceId || !dmsId) {
            throw new Error('workspaceId and dmsId are required when link is not provided');
        }
        itemPath = `/api/v3/workspaces/${workspaceId}/items/${dmsId}`;
    }

    const itemUrl = itemPath.startsWith('http') ? itemPath : `${APS_BASE(tenant)}${itemPath}`;

    await httpRequest({
        method: 'PATCH',
        url: `${itemUrl}?deleted=true`,
        body: {}
    });

    return { archived: true };
}

/**
 * Unarchive (restore) an item.
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.workspaceId
 * @param {number=} params.dmsId
 * @param {string=} params.link
 */
export async function unarchiveItem({
    tenant,
    workspaceId,
    dmsId,
    link
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    let itemPath;

    if (link) {
        itemPath = link;
    } else {
        if (!workspaceId || !dmsId) {
            throw new Error(
                'workspaceId and dmsId are required when link is not provided'
            );
        }
        itemPath = `/api/v3/workspaces/${workspaceId}/items/${dmsId}`;
    }

    const itemUrl = itemPath.startsWith('http') ? itemPath : `${APS_BASE(tenant)}${itemPath}`;

    await httpRequest({
        method: 'PATCH',
        url: `${itemUrl}?deleted=false`,
        body: {}
    });

    return { unarchived: true };
}

/**
 * Determine whether an item is archived (soft-deleted).
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.workspaceId
 * @param {number=} params.dmsId
 * @param {string=} params.link
 *
 * @returns {Promise<boolean>} True if archived, false otherwise
 */
export async function isItemArchived({
    tenant,
    workspaceId,
    dmsId,
    link
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    let itemPath;

    if (link) {
        itemPath = link;
    } else {
        if (!workspaceId || !dmsId) {
            throw new Error(
                'workspaceId and dmsId are required when link is not provided'
            );
        }
        itemPath = `/api/v3/workspaces/${workspaceId}/items/${dmsId}`;
    }

    const itemUrl = itemPath.startsWith('http') ? itemPath : `${APS_BASE(tenant)}${itemPath}`;

    const item = await httpRequest({
        method: 'GET',
        url: itemUrl
    });

    return Boolean(item?.deleted);
}

/**
 * Get an item's descriptor (title).
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.workspaceId
 * @param {number=} params.dmsId
 * @param {string=} params.link
 *
 * @returns {Promise<string|null>} Item title
 */
export async function getItemDescriptor({
    tenant,
    workspaceId,
    dmsId,
    link
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    let itemPath;

    if (link) {
        itemPath = link;
    } else {
        if (!workspaceId || !dmsId) {
            throw new Error(
                'workspaceId and dmsId are required when link is not provided'
            );
        }
        itemPath = `/api/v3/workspaces/${workspaceId}/items/${dmsId}`;
    }

    const itemUrl = itemPath.startsWith('http') ? itemPath : `${APS_BASE(tenant)}${itemPath}`;

    const item = await httpRequest({
        method: 'GET',
        url: itemUrl
    });

    return item?.title ?? null;
}

/**
 * Get an item's change summary (audit history).
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.workspaceId
 * @param {number=} params.dmsId
 * @param {string=} params.link
 *
 * @returns {Promise<Object>} Audit summary payload
 */
export async function getItemChangeSummary({
    tenant,
    workspaceId,
    dmsId,
    link
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    let itemPath;

    if (link) {
        itemPath = link;
    } else {
        if (!workspaceId || !dmsId) {
            throw new Error(
                'workspaceId and dmsId are required when link is not provided'
            );
        }
        itemPath = `/api/v3/workspaces/${workspaceId}/items/${dmsId}`;
    }

    const itemUrl = itemPath.startsWith('http') ? itemPath : `${APS_BASE(tenant)}${itemPath}`;

    return httpRequest({
        method: 'GET',
        url: `${itemUrl}/audit`
    });
}

/**
 * Set the primary owner of an item.
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.workspaceId
 * @param {number=} params.dmsId
 * @param {string=} params.link
 * @param {string} params.owner        // User ID
 * @param {boolean=} params.notify     // Notify new owner
 */
export async function setItemOwner({
    tenant,
    workspaceId,
    dmsId,
    link,
    owner,
    notify = false
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    if (!owner) {
        throw new Error('owner is required');
    }

    let itemPath;

    if (link) {
        itemPath = link;
    } else {
        if (!workspaceId || !dmsId) {
            throw new Error(
                'workspaceId and dmsId are required when link is not provided'
            );
        }
        itemPath = `/api/v3/workspaces/${workspaceId}/items/${dmsId}`;
    }

    const ownersUrl = `${itemPath.startsWith('http') ? itemPath : `${APS_BASE(tenant)}` + itemPath}/owners`;

    const response = await httpRequest({
        method: 'GET',
        url: ownersUrl
    });

    const owners = Array.isArray(response?.owners) ? response.owners : [];

    owners[0] = {
        notify,
        ownerType: 'PRIMARY',
        __self__: `${itemPath}/owners/${owner}`
    };

    await httpRequest({
        method: 'PUT',
        url: ownersUrl,
        body: owners
    });

    return { ownerSet: true };
}

/**
 * Add an additional owner (user and/or group) to an item.
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.workspaceId
 * @param {number=} params.dmsId
 * @param {string=} params.link
 * @param {string=} params.user       // User ID
 * @param {string=} params.group      // Group link
 */
export async function addItemOwner({
    tenant,
    workspaceId,
    dmsId,
    link,
    user,
    group
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    if (!user && !group) {
        throw new Error('user or group must be provided');
    }

    let itemPath;

    if (link) {
        itemPath = link;
    } else {
        if (!workspaceId || !dmsId) {
            throw new Error(
                'workspaceId and dmsId are required when link is not provided'
            );
        }
        itemPath = `/api/v3/workspaces/${workspaceId}/items/${dmsId}`;
    }

    const ownersUrl = `${itemPath.startsWith('http') ? itemPath : `${APS_BASE(tenant)}` + itemPath}/owners`;

    const response = await httpRequest({
        method: 'GET',
        url: ownersUrl
    });

    const owners = Array.isArray(response?.owners) ? [...response.owners] : [];

    let isNewUser = Boolean(user);
    let isNewGroup = Boolean(group);

    const groupId = group ? group.split('/').pop() : null;

    for (const owner of owners) {
        if (user && owner.ownerType === 'ADDITIONAL_USER') {
            if (owner.detailsLink?.split('/').pop() === user) {
                isNewUser = false;
            }
        }

        if (group && owner.ownerType === 'ADDITIONAL_GROUP') {
            if (owner.detailsLink === group) {
                isNewGroup = false;
            }
        }
    }

    if (isNewUser) {
        owners.push({
            ownerType: 'ADDITIONAL_USER',
            __self__: `${itemPath}/owners/${user}`
        });
    }

    if (isNewGroup && groupId) {
        owners.push({
            ownerType: 'ADDITIONAL_GROUP',
            __self__: `${itemPath}/owners/${groupId}`
        });
    }

    if (isNewUser || isNewGroup) {
        await httpRequest({
            method: 'PUT',
            url: ownersUrl,
            body: owners
        });
    }

    return { ownerAdded: isNewUser || isNewGroup };
}

/**
 * Remove an additional owner (user and/or group) from an item.
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.workspaceId
 * @param {number=} params.dmsId
 * @param {string=} params.link
 * @param {string=} params.user       // User ID
 * @param {string=} params.group      // Group link
 */
export async function removeItemOwner({
    tenant,
    workspaceId,
    dmsId,
    link,
    user,
    group
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    if (!user && !group) {
        throw new Error('user or group must be provided');
    }

    let itemPath;

    if (link) {
        itemPath = link;
    } else {
        if (!workspaceId || !dmsId) {
            throw new Error(
                'workspaceId and dmsId are required when link is not provided'
            );
        }
        itemPath = `/api/v3/workspaces/${workspaceId}/items/${dmsId}`;
    }

    const ownersUrl = `${itemPath.startsWith('http') ? itemPath : `${APS_BASE(tenant)}` + itemPath}/owners`;

    const response = await httpRequest({
        method: 'GET',
        url: ownersUrl
    });

    const owners = Array.isArray(response?.owners)
        ? response.owners
        : [];

    if (owners.length === 0) {
        return { ownerRemoved: false };
    }

    const groupId = group ? group.split('/').pop() : null;
    const newOwners = [owners[0]]; // PRIMARY owner always retained

    for (const owner of owners.slice(1)) {
        const ownerId = owner.detailsLink?.split('/').pop();

        if (
            (owner.ownerType === 'ADDITIONAL_USER' && user && ownerId === user) ||
            (owner.ownerType === 'ADDITIONAL_GROUP' && groupId && ownerId === groupId)
        ) {
            continue;
        }

        newOwners.push(owner);
    }

    if (newOwners.length !== owners.length) {
        await httpRequest({
            method: 'PUT',
            url: ownersUrl,
            body: newOwners
        });

        return { ownerRemoved: true };
    }

    return { ownerRemoved: false };
}

/**
 * Clear all additional owners from an item,
 * preserving the primary owner.
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.workspaceId
 * @param {number=} params.dmsId
 * @param {string=} params.link
 */
export async function clearItemOwners({
    tenant,
    workspaceId,
    dmsId,
    link
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    let itemPath;

    if (link) {
        itemPath = link;
    } else {
        if (!workspaceId || !dmsId) {
            throw new Error(
                'workspaceId and dmsId are required when link is not provided'
            );
        }
        itemPath = `/api/v3/workspaces/${workspaceId}/items/${dmsId}`;
    }

    const ownersUrl = `${itemPath.startsWith('http') ? itemPath : `${APS_BASE(tenant)}` + itemPath}/owners`;

    const response = await httpRequest({
        method: 'GET',
        url: ownersUrl
    });

    const owners = Array.isArray(response?.owners) ? response.owners : [];

    if (owners.length <= 1) {
        return { ownersCleared: false };
    }

    const newOwners = [owners[0]];

    await httpRequest({
        method: 'PUT',
        url: ownersUrl,
        body: newOwners
    });

    return { ownersCleared: true };
}

/**
 * Get full item details.
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.workspaceId
 * @param {number=} params.dmsId
 * @param {string=} params.link
 *
 * @returns {Promise<Object>} Item details payload
 */
export async function getItemDetails({
     tenant,
     workspaceId,
     dmsId,
     link
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    let itemPath;

    if (link) {
        itemPath = link;
    } else {
        if (!workspaceId || !dmsId) {
            throw new Error(
                'workspaceId and dmsId are required when link is not provided'
            );
        }
        itemPath = `/api/v3/workspaces/${workspaceId}/items/${dmsId}`;
    }

    const itemUrl = itemPath.startsWith('http') ? itemPath : `${APS_BASE(tenant)}${itemPath}`;

    return httpRequest({
        method: 'GET',
        url: itemUrl
    });
}

function inferImageMimeFromBytes(bytes) {
    if (
        bytes?.length >= 8 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47
    ) return 'image/png';

    if (bytes?.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
        return 'image/jpeg';
    }

    if (
        bytes?.length >= 6 &&
        bytes[0] === 0x47 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x38
    ) return 'image/gif';

    if (
        bytes?.length >= 4 &&
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46
    ) return 'image/webp';

    return 'image/png';
}

function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = '';

    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }

    return btoa(binary);
}

const IMAGE_LINK_PATH_REGEX = /\/api\/v\d+\/workspaces\/(\d+)\/items\/(\d+)\/field-values\/[^/]+\/image\/(\d+)(?:[/?#]|$)/i;

function normalizeImageMimeFromContentType(contentType) {
    const normalized = String(contentType || '')
        .split(';')[0]
        .trim()
        .toLowerCase();

    if (!normalized || !normalized.startsWith('image/')) return null;
    if (normalized === 'image/jpg') return 'image/jpeg';
    return normalized;
}

function looksLikeHtmlPayload(bytes) {
    if (!bytes || bytes.length < 4) return false;
    const sample = Array.from(bytes.subarray(0, Math.min(bytes.length, 80)))
        .map((code) => String.fromCharCode(code))
        .join('')
        .trim()
        .toLowerCase();
    return (
        sample.startsWith('<!doctype html') ||
        sample.startsWith('<html') ||
        sample.startsWith('<head') ||
        sample.startsWith('<body')
    );
}

function parseImagePathParts(link) {
    const match = IMAGE_LINK_PATH_REGEX.exec(String(link || '').trim());
    if (!match) return null;
    const workspaceId = Number(match[1]);
    const dmsId = Number(match[2]);
    const imageId = Number(match[3]);
    if (!Number.isFinite(workspaceId) || !Number.isFinite(dmsId) || !Number.isFinite(imageId)) return null;
    return { workspaceId, dmsId, imageId };
}

function buildItemImagePath({ workspaceId, dmsId, imageId, fieldId = 'IMAGE' }) {
    return (
        `/api/v2/workspaces/${workspaceId}` +
        `/items/${dmsId}` +
        `/field-values/${fieldId}` +
        `/image/${imageId}`
    );
}

/**
 * Fetch an item image from a field-value image link and return as a data URL.
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {string} params.link
 *
 * @returns {Promise<{dataUrl: string}>}
 */
export async function getFieldImageData({
    tenant,
    link
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }
    if (!link || typeof link !== 'string') {
        throw new Error('link is required');
    }

    const imagePathParts = parseImagePathParts(link);
    const normalizedPath = imagePathParts
        ? buildItemImagePath({
            workspaceId: imagePathParts.workspaceId,
            dmsId: imagePathParts.dmsId,
            imageId: imagePathParts.imageId,
            fieldId: 'IMAGE'
        })
        : link;
    const url = normalizedPath.startsWith('http') ? normalizedPath : `${APS_BASE(tenant)}${normalizedPath}`;
    const imageResponse = await httpBinaryRequestWithMeta({
        method: 'GET',
        url,
        headers: {
            Accept: 'image/png,image/jpeg,image/gif,image/webp,image/*,*/*;q=0.8'
        },
        responseType: 'arraybuffer'
    });

    const buffer = imageResponse.data;
    const bytes = new Uint8Array(buffer);
    const mimeFromHeader = normalizeImageMimeFromContentType(imageResponse.contentType);
    if (!mimeFromHeader && looksLikeHtmlPayload(bytes)) {
        throw new Error('Image request returned HTML instead of binary image data.');
    }
    const mime = mimeFromHeader || inferImageMimeFromBytes(bytes);
    const base64 = arrayBufferToBase64(buffer);

    return {
        dataUrl: `data:${mime};base64,${base64}`
    };
}

/**
 * Get derived (pivot) field values for an item.
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number} params.workspaceId
 * @param {number|string} params.fieldId        // Pivot field ID
 * @param {number|string=} params.pivotItemId   // Item ID used for derivation
 * @param {string=} params.link                 // Item link (fallback for pivotItemId)
 *
 * @returns {Promise<Object>} Derived sections payload
 */
export async function getDerivedFieldValues({
    tenant,
    workspaceId,
    fieldId,
    pivotItemId,
    link
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    if (!workspaceId) {
        throw new Error('workspaceId is required');
    }

    if (!fieldId) {
        throw new Error('fieldId is required');
    }

    let resolvedPivotItemId = pivotItemId;

    if (!resolvedPivotItemId) {
        if (!link) {
            throw new Error('pivotItemId or link is required');
        }
        resolvedPivotItemId = link.split('/')[6];
    }

    if (!resolvedPivotItemId) {
        throw new Error('Unable to resolve pivotItemId');
    }

    const url = `${APS_BASE(tenant)}/api/v3/workspaces/${workspaceId}/views/1/pivots/${fieldId}?pivotItemId=${resolvedPivotItemId}`;

    const response = await httpRequest({
        method: 'GET',
        url
    });

    if (response === '') {
        return { sections: [] };
    }

    return response;
}

export async function getItemImage({
    tenant,
    workspaceId,
    dmsId,
    fieldId,
    imageId,
    link
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    let imagePath = link || '';
    const parsedFromLink = link ? parseImagePathParts(link) : null;

    if (parsedFromLink) {
        imagePath = buildItemImagePath({
            workspaceId: parsedFromLink.workspaceId,
            dmsId: parsedFromLink.dmsId,
            imageId: parsedFromLink.imageId,
            fieldId: 'IMAGE'
        });
    } else if (!imagePath) {
        imagePath = buildItemImagePath({
            workspaceId,
            dmsId,
            imageId,
            fieldId: fieldId || 'IMAGE'
        });
    }

    const imageUrl = imagePath.startsWith('http') ? imagePath : `${APS_BASE(tenant)}${imagePath}`;

    const response = await httpBinaryRequestWithMeta({
        method: 'GET',
        url: imageUrl,
        headers: {
            Accept: 'image/png,image/jpeg,image/gif,image/webp,image/*,*/*;q=0.8'
        },
        responseType: 'base64'
    });

    const mimeFromHeader = normalizeImageMimeFromContentType(response.contentType);
    if (!mimeFromHeader) {
        throw new Error(`Unexpected image content-type: ${response.contentType || 'unknown'}`);
    }

    return response.data;
}

/**
 * Get grid (view 13) rows for an item.
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.workspaceId
 * @param {number=} params.dmsId
 * @param {string=} params.link
 *
 * @returns {Promise<Array>} Grid rows
 */
export async function getItemGridData({
    tenant,
    workspaceId,
    dmsId,
    link
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    let itemPath;

    if (link) {
        itemPath = link;
    } else {
        if (!workspaceId || !dmsId) {
            throw new Error(
                'workspaceId and dmsId are required when link is not provided'
            );
        }
        itemPath = `/api/v3/workspaces/${workspaceId}/items/${dmsId}`;
    }

    const url = `${itemPath.startsWith('http') ? itemPath : `${APS_BASE(tenant)}${itemPath}`}/views/13/rows`;

    const response = await httpRequest({
        method: 'GET',
        url
    });

    if (!response || response === '') {
        return [];
    }

    return Array.isArray(response.rows) ? response.rows : [];
}

/**
 * Add a row to the item grid (view 13).
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.workspaceId
 * @param {number=} params.dmsId
 * @param {number=} params.viewId
 * @param {string=} params.link
 * @param {Array} params.data
 *
 * @returns {Promise<string>} Location of new row
 */
export async function addItemGridRow({
    tenant,
    workspaceId,
    dmsId,
    viewId = 13,
    link,
    data
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    if (!Array.isArray(data)) {
        throw new Error('data must be an array');
    }

    let itemPath;
    let resolvedWorkspaceId = workspaceId;

    if (link) {
        itemPath = link;
        if (!resolvedWorkspaceId) {
            resolvedWorkspaceId = link.split('/')[4];
        }
    } else {
        if (!workspaceId || !dmsId) {
            throw new Error(
                'workspaceId and dmsId are required when link is not provided'
            );
        }
        itemPath = `/api/v3/workspaces/${workspaceId}/items/${dmsId}`;
    }

    const resolvedViewId = Number.isFinite(Number(viewId)) ? Number(viewId) : 13;
    const url = `${itemPath.startsWith('http') ? itemPath : `${APS_BASE(tenant)}${itemPath}`}/views/${resolvedViewId}/rows`;

    const rowData = buildGridRowPayload({
        tenant,
        workspaceId: resolvedWorkspaceId,
        viewId: resolvedViewId,
        data
    });

    const response = await httpRequest({
        method: 'POST',
        url,
        body: { rowData }
    });

    return response?.location ?? null;
}

/**
 * Update an existing grid row (view 13).
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.workspaceId
 * @param {number=} params.dmsId
 * @param {number=} params.viewId
 * @param {string=} params.link
 * @param {string|number} params.rowId
 * @param {Array} params.data
 *
 * @returns {Promise<Array>} Updated grid rows
 */
export async function updateItemGridRow({
    tenant,
    workspaceId,
    dmsId,
    viewId = 13,
    link,
    rowId,
    data
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    if (!rowId) {
        throw new Error('rowId is required');
    }

    if (!Array.isArray(data)) {
        throw new Error('data must be an array');
    }

    let itemPath;
    let resolvedWorkspaceId = workspaceId;

    if (link) {
        itemPath = link;
        if (!resolvedWorkspaceId) {
            resolvedWorkspaceId = link.split('/')[4];
        }
    } else {
        if (!workspaceId || !dmsId) {
            throw new Error(
                'workspaceId and dmsId are required when link is not provided'
            );
        }
        itemPath = `/api/v3/workspaces/${workspaceId}/items/${dmsId}`;
    }

    const resolvedViewId = Number.isFinite(Number(viewId)) ? Number(viewId) : 13;
    const url = `${itemPath.startsWith('http') ? itemPath : `${APS_BASE(tenant)}${itemPath}`}/views/${resolvedViewId}/rows/${rowId}`;

    const rowData = buildGridRowPayload({
        tenant,
        workspaceId: resolvedWorkspaceId,
        viewId: resolvedViewId,
        data
    });

    const response = await httpRequest({
        method: 'PUT',
        url,
        body: { rowData }
    });

    if (!response || response === '') {
        return [];
    }

    return Array.isArray(response.rows) ? response.rows : [];
}

/**
 * Remove a grid row.
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {string} params.link   // Full row link
 */
export async function removeItemGridRow({
    tenant,
    link
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    if (!link) {
        throw new Error('row link is required');
    }

    const url = link.startsWith('http') ? link : `${APS_BASE(tenant)}${link}`;

    await httpRequest({
        method: 'DELETE',
        url
    });

    return { removed: true };
}

/**
 * Get grid (view 13) column definitions.
 * Optionally enrich fields with validation metadata.
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.workspaceId
 * @param {string=} params.link
 * @param {boolean=} params.getValidations
 *
 * @returns {Promise<Object>} Grid fields payload
 */
export async function getItemGridColumns({
     tenant,
     workspaceId,
     link,
     getValidations = false
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    let resolvedWorkspaceId = workspaceId;

    if (!resolvedWorkspaceId) {
        if (!link) {
            throw new Error('workspaceId or link is required');
        }
        resolvedWorkspaceId = link.split('/')[4];
    }

    const fieldsUrl = `${APS_BASE(tenant)}/api/v3/workspaces/${resolvedWorkspaceId}/views/13/fields`;

    const response = await httpRequest({
        method: 'GET',
        url: fieldsUrl
    });

    if (!response || response === '' || !Array.isArray(response.fields)) {
        return response;
    }

    if (!getValidations) {
        return response;
    }

    const validationLinks = response.fields.map(field => field.validators).filter(Boolean);

    if (validationLinks.length === 0) {
        return response;
    }

    const validationResponses = await Promise.all(
        validationLinks.map(link =>
            httpRequest({
                method: 'GET',
                url: link.startsWith('http') ? link : `${APS_BASE(tenant)}${link}`
            })
        )
    );

    for (const field of response.fields) {
        field.validations = [];
        field.required = false;

        if (!field.validators) continue;

        const match = validationResponses.find(
            v =>
                Array.isArray(v) &&
                v.length > 0 &&
                v[0].__self__?.startsWith(field.validators)
        );

        if (match) {
            field.validations = match;
            field.required = match.some(
                validator => validator.validatorName === 'required'
            );
        }
    }

    return response;
}

/**
 * Get item suppliers (view 8).
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.wsId
 * @param {number=} params.dmsId
 * @param {string=} params.link
 *
 * @returns {Promise<Object>} Suppliers payload
 */
export async function getItemSuppliers({
    tenant,
    wsId,
    dmsId,
    link
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    if (!link && (!wsId || !dmsId)) {
        throw new Error('either link or wsId + dmsId are required');
    }

    const url = `${link ? (link.startsWith('http') ? link : `${APS_BASE(tenant)}${link}`) : `${APS_BASE(tenant)}/api/v3/workspaces/${wsId}/items/${dmsId}`}/views/8/suppliers`;

    return httpRequest({
        method: 'GET',
        url
    });
}

/**
 * Get single supplier quote.
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {string} params.link
 *
 * @returns {Promise<Object>} Quote payload
 */
export async function getSupplierQuote({
    tenant,
    link
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    if (!link) {
        throw new Error('link is required');
    }

    const url = link.startsWith('http') ? link : `${APS_BASE(tenant)}${link}`;

    return httpRequest({
        method: 'GET',
        url
    });
}

/**
 * Get all supplier quotes for an item (view 8).
 *
 * Fetches suppliers first, then resolves all quote collections
 * and attaches them to their respective suppliers.
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.wsId
 * @param {number=} params.dmsId
 * @param {string=} params.link
 *
 * @returns {Promise<Object>} Suppliers with quotes attached
 */
export async function getItemQuotes({
    tenant,
    wsId,
    dmsId,
    link
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    if (!link && (!wsId || !dmsId)) {
        throw new Error('either link or wsId + dmsId are required');
    }

    const suppliersUrl = `${link ? (link.startsWith('http') ? link : `${APS_BASE(tenant)}${link}`) : `${APS_BASE(tenant)}/api/v3/workspaces/${wsId}/items/${dmsId}`}/views/8/suppliers`;

    const suppliersResponse = await httpRequest({
        method: 'GET',
        url: suppliersUrl
    });

    const suppliers = suppliersResponse?.suppliers || [];

    if (!suppliers.length) {
        return suppliersResponse;
    }

    await Promise.all(
        suppliers.map(async supplier => {
            const url = supplier.quotes.link.startsWith('http') ? supplier.quotes.link : `${APS_BASE(tenant)}${supplier.quotes.link}`;

            supplier.quotes.data = await httpRequest({
                method: 'GET',
                url
            });
        })
    );


    return suppliersResponse;
}

/**
 * Get item relationships (view 10).
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.wsId
 * @param {number=} params.dmsId
 * @param {string=} params.link
 *
 * @returns {Promise<Array>} Relationships payload (empty array if none)
 */
export async function getItemRelationships({
    tenant,
    wsId,
    dmsId,
    link
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    if (!link && (!wsId || !dmsId)) {
        throw new Error('either link or wsId + dmsId are required');
    }

    const url = `${link?.startsWith('http') ? link : `${APS_BASE(tenant)}${link || `/api/v3/workspaces/${wsId}/items/${dmsId}`}`}/views/10`;

    const response = await httpRequest({
        method: 'GET',
        url
    });

    if (!response?.data || response.data === '') {
        response.data = [];
    }

    return response;
}

/**
 * Add a relationship to an item (view 10).
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.wsId
 * @param {number=} params.dmsId
 * @param {string=} params.link
 * @param {string} params.relatedId
 * @param {string=} params.description
 * @param {string=} params.type - 'bi' (default) or 'uni'
 *
 * @returns {Promise<Object>} Created relationship response
 */
export async function addItemRelationship({
    tenant,
    wsId,
    dmsId,
    link,
    relatedId,
    description = '',
    type = 'bi'
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    if (!relatedId) {
        throw new Error('relatedId is required');
    }

    if (!link && (!wsId || !dmsId)) {
        throw new Error('either link or wsId + dmsId are required');
    }

    const url = link?.startsWith('http') ? link : `${APS_BASE(tenant)}${link || `/api/v3/workspaces/${wsId}/items/${dmsId}`}/views/10`;
    const directionType = type.toLowerCase() === 'bi' ? 'Bi-Directional' : 'Uni-Directional';

    const headers = {
        'content-location': `${url}/linkable-items/${relatedId}`
    };

    const payload = {
        description,
        direction: {
            type: directionType
        }
    };

    return httpRequest({
        method: 'POST',
        url,
        body: payload,
        headers
    });
}

/**
 * Update a relationship description.
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {string} params.link - Absolute or relative link to the relationship
 * @param {string} params.description
 *
 * @returns {Promise<Object>} Updated relationship response
 */
export async function updateRelationship({
    tenant,
    link,
    description
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    if (!link) {
        throw new Error('link is required');
    }

    if (description === undefined || description === null) {
        throw new Error('description is required');
    }

    const url = link.startsWith('http') ? link : `${APS_BASE(tenant)}${link}`;

    return httpRequest({
        method: 'PUT',
        url,
        body: {
            description
        }
    });
}

/**
 * Remove a relationship.
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {string} params.link - Absolute or relative link to the relationship
 *
 * @returns {Promise<Object>} Response confirming removal
 */
export async function removeRelationship({
    tenant,
    link
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    if (!link) {
        throw new Error('link is required');
    }

    const url = link.startsWith('http') ? link : `${APS_BASE(tenant)}${link}`;

    return httpRequest({
        method: 'DELETE',
        url
    });
}

/**
 * Get affected items for an item (view 11).
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.wsId
 * @param {number=} params.dmsId
 * @param {string=} params.link
 *
 * @returns {Promise<{data: Array, status: number}>} Affected items and HTTP status
 */
export async function getAffectedItems({
    tenant,
    wsId,
    dmsId,
    link
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    if (!link && (!wsId || !dmsId)) {
        throw new Error('either link or wsId + dmsId are required');
    }

    const url = `${link?.startsWith('http') ? link : `${APS_BASE(tenant)}${link || `/api/v3/workspaces/${wsId}/items/${dmsId}`}`}/views/11`;

    const response = await httpRequest({
        method: 'GET',
        url
    });

    const affectedItems = response?.data === '' ? [] : response.data?.affectedItems || [];

    return {
        data: affectedItems,
        status: response.status
    };
}

/**
 * Get details for a managed item (view 11 / affected items).
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.wsId
 * @param {number=} params.dmsId
 * @param {string=} params.itemId
 * @param {string=} params.link
 *
 * @returns {Promise<Object>} Managed item details
 */
export async function getManagedItem({
     tenant,
     wsId,
     dmsId,
     itemId,
     link
 }) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    if (!link && (!wsId || !dmsId || !itemId)) {
        throw new Error('either link or wsId + dmsId + itemId are required');
    }

    const url = link?.startsWith('http') ? link : `${APS_BASE(tenant)}${link || `/api/v3/workspaces/${wsId}/items/${dmsId}/views/11/affected-items/${itemId}`}`;

    return httpRequest({
        method: 'GET',
        url
    });
}

/**
 * Get columns (fields) for managed items tab (view 11).
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.wsId
 * @param {string=} params.link
 *
 * @returns {Promise<{data: Array, status: number}>} Managed fields and HTTP status
 */
export async function getManagedItemFields({
    tenant,
    wsId,
    link
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    if (!link && !wsId) {
        throw new Error('either link or wsId is required');
    }

    const resolvedWsId = wsId || link.split('/')[4];
    const url = link?.startsWith('http') ? `${link}/views/11/fields` : `${APS_BASE(tenant)}/api/v3/workspaces/${resolvedWsId}/views/11/fields`;

    const response = await httpRequest({
        method: 'GET',
        url
    });

    const fields = response?.data === '' ? [] : response.data?.fields || [];

    return {
        data: fields,
        status: response.status
    };
}

/**
 * Add multiple managed items to an item.
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.wsId
 * @param {number=} params.dmsId
 * @param {string=} params.link
 * @param {Array<Object>} params.items - Array of managed items to add
 *
 * @returns {Promise<{success: boolean, message: Array<string>, data: any}>} Bulk add result
 */
export async function addManagedItems({
    tenant,
    wsId,
    dmsId,
    link,
    items
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    if (!items || !Array.isArray(items) || !items.length) {
        throw new Error('items array is required and cannot be empty');
    }

    if (!link && (!wsId || !dmsId)) {
        throw new Error('either link or wsId + dmsId are required');
    }

    const url = `${link?.startsWith('http') ? link : `${APS_BASE(tenant)}${link || `/api/v3/workspaces/${wsId}/items/${dmsId}`}`}/affected-items`;

    const headers = {
        Accept: 'application/vnd.autodesk.plm.affected.items.bulk+json'
    };

    const response = await httpRequest({
        method: 'POST',
        url,
        data: items,
        headers
    });

    let error = false;
    const messages = [];

    if (response?.data && response.data !== '') {
        for (const entry of response.data) {
            if (entry.result === 'FAILED') {
                error = true;
                if (entry.errorMessage) messages.push(entry.errorMessage);
            }
        }
    }

    return {
        success: !error,
        message: messages,
        data: response
    };
}

/**
 * Update linked fields (columns) of a managed item.
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {string} params.link - Absolute or relative link to the managed item
 * @param {Array<Object>} params.fields - Array of linked fields to update
 * @param {string=} params.transition - Optional transition link
 *
 * @returns {Promise<Object>} Updated managed item response
 */
export async function updateManagedItem({
    tenant,
    link,
    fields,
    transition
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    if (!link) {
        throw new Error('link is required');
    }

    if (!fields || !Array.isArray(fields)) {
        throw new Error('fields array is required');
    }

    const url = link.startsWith('http') ? link : `${APS_BASE(tenant)}${link}`;

    const payload = {
        linkedFields: fields
    };

    if (transition) {
        payload.targetTransition = { link: transition };
    }

    return httpRequest({
        method: 'PUT',
        url,
        body: payload
    });
}

/**
 * Remove a managed item from an item (view 11 / affected items).
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.wsId
 * @param {number=} params.dmsId
 * @param {string=} params.link
 * @param {string} params.itemId - ID of the managed item to remove
 *
 * @returns {Promise<{success: boolean, message: Array<string>, data: any}>} Removal result
 */
export async function removeManagedItem({
    tenant,
    wsId,
    dmsId,
    link,
    itemId
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    if (!itemId) {
        throw new Error('itemId is required');
    }

    if (!link && (!wsId || !dmsId)) {
        throw new Error('either link or wsId + dmsId are required');
    }

    const url = `${link?.startsWith('http') ? link : `${APS_BASE(tenant)}${link || `/api/v3/workspaces/${wsId}/items/${dmsId}`}`}/views/11/affected-items/${itemId}`;

    const response = await httpRequest({
        method: 'DELETE',
        url
    });

    let error = false;
    const messages = [];

    if (response?.data && response.data !== '') {
        for (const entry of response.data) {
            if (entry.result === 'FAILED') {
                error = true;
                if (entry.errorMessage) messages.push(entry.errorMessage);
            }
        }
    }

    return {
        success: !error,
        message: messages,
        data: response
    };
}

/**
 * Get related changes for an item (view 2).
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.wsId
 * @param {number=} params.dmsId
 * @param {string=} params.link
 *
 * @returns {Promise<Array>} Related changes
 */
export async function getRelatedChanges({
    tenant,
    wsId,
    dmsId,
    link
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    if (!link && (!wsId || !dmsId)) {
        throw new Error('either link or wsId + dmsId are required');
    }

    const url = link?.startsWith('http') ? link : `${APS_BASE(tenant)}${link || `/api/v3/workspaces/${wsId}/items/${dmsId}`}/views/2`;

    const response = await httpRequest({
        method: 'GET',
        url
    });

    return response?.data === '' ? [] : response.data;
}

/**
 * Get attachments for an item with optional include/exclude filename filters.
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.wsId
 * @param {number=} params.dmsId
 * @param {string=} params.link
 * @param {Array<string>=} params.filenamesIn - Include only these filenames (partial match)
 * @param {Array<string>=} params.filenamesEx - Exclude these filenames (partial match)
 *
 * @returns {Promise<{data: Array, status: number}>} Filtered attachments and HTTP status
 */
export async function getAttachments({
     tenant,
     wsId,
     dmsId,
     link,
     filenamesIn = [],
     filenamesEx = []
 }) {
    if (!tenant) throw new Error('tenant is required');
    if (!link && (!wsId || !dmsId)) throw new Error('either link or wsId + dmsId are required');

    const itemPath = link || `/api/v3/workspaces/${wsId}/items/${dmsId}`;
    const itemUrl = itemPath.startsWith('http') ? itemPath : `${APS_BASE(tenant)}${itemPath}`;

    const url = itemUrl.endsWith('/attachments') ? `${itemUrl}?asc=name` : `${itemUrl}/attachments?asc=name`;

    if (!Array.isArray(filenamesIn)) filenamesIn = [filenamesIn];
    if (!Array.isArray(filenamesEx)) filenamesEx = [filenamesEx];

    const response = await httpRequest({
        method: 'GET',
        url,
        headers: {
            Accept: 'application/vnd.autodesk.plm.attachments.bulk+json'
        }
    });

    const attachments = [];

    if (response && response !== '') {
        for (const attachment of response.attachments || []) {
            if (attachment?.type && !attachment.type.extension) {
                attachment.type.extension = '';
            }

            const ext = attachment.type?.extension || '';
            const fileName = (attachment.resourceName + ext).toLowerCase();

            let included =
                filenamesIn.length === 0 ||
                filenamesIn.some(f => fileName.includes(String(f).toLowerCase()));

            if (included && filenamesEx.length > 0) {
                included = !filenamesEx.some(f => fileName.includes(String(f).toLowerCase()));
            }

            if (included) attachments.push(attachment);
        }
    }

    return {
        data: attachments,
        status: 200
    };
}

/**
 * Get related attachments for an item.
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.wsId
 * @param {number=} params.dmsId
 * @param {string=} params.link
 *
 * @returns {Promise<Array>} Related attachments
 */
export async function getRelatedAttachments({
    tenant,
    wsId,
    dmsId,
    link
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    if (!link && (!wsId || !dmsId)) {
        throw new Error('either link or wsId + dmsId are required');
    }

    const url = link?.startsWith('http') ? `${link}/related-attachments?asc=name` : `${APS_BASE(tenant)}${link || `/api/v3/workspaces/${wsId}/items/${dmsId}`}/related-attachments?asc=name`;

    const response = await httpRequest({
        method: 'GET',
        url
    });

    return response?.data === '' ? [] : response.data;
}

/**
 * Download an attachment as binary data.
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.wsId
 * @param {number=} params.dmsId
 * @param {string=} params.link - Base link to the item
 * @param {string=} params.fileLink - Absolute link to the file (overrides link + fileId)
 * @param {string=} params.fileId - File ID (used if fileLink not provided)
 *
 * @returns {Promise<ArrayBuffer>} Binary data of the attachment
 */
export async function downloadAttachment({
     tenant,
     wsId,
     dmsId,
     link,
     fileLink,
     fileId
 }) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    if (!fileLink && !fileId) {
        throw new Error('either fileLink or fileId is required');
    }

    const url = fileLink?.startsWith('http') ? fileLink : `${APS_BASE(tenant)}${link || `/api/v3/workspaces/${wsId}/items/${dmsId}`}/attachments/${fileId}`;

    return httpBinaryRequest({
        method: 'GET',
        url
    });
}

/**
 * Export attachments for a PLM item
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {string} params.wsId
 * @param {string} params.dmsId
 * @param {string=} params.link
 * @param {string=} params.rootFolder
 * @param {string=} params.folder
 * @param {string=} params.includeDMSID - 'prefix'|'suffix'|'no'
 * @param {string|string[]=} params.filenamesIn
 * @param {string|string[]=} params.filenamesEx
 * @param {boolean=} params.indexFile
 *
 * @returns {Promise<{data:string[], success:boolean}>}
 */
export async function exportAttachments({
    tenant,
    wsId,
    dmsId,
    link,
    rootFolder = 'exports',
    folder = '',
    includeDMSID = 'no',  // 'prefix'|'suffix'|'no'
    filenamesIn = '',
    filenamesEx = '',
    indexFile = true
}) {
    if (!tenant) throw new Error('tenant is required');
    if (!link && (!wsId || !dmsId)) throw new Error('either link or wsId + dmsId are required');
    if (!chrome?.downloads) throw new Error('chrome.downloads API unavailable');

    const itemPath = link || `/api/v3/workspaces/${wsId}/items/${dmsId}`;
    const itemUrl = itemPath.startsWith('http') ? itemPath : `${APS_BASE(tenant)}${itemPath}`;
    const listUrl = `${itemUrl}/attachments?asc=name`;

    const payload = await httpRequest({
        method: 'GET',
        url: listUrl,
        headers: { Accept: 'application/vnd.autodesk.plm.attachments.bulk+json' }
    });

    const attachments = (payload === '') ? [] : (payload.attachments || []);
    const title = payload?.item?.title || '';
    const resolvedWsId = String(wsId || (link ? link.split('/')[4] : ''));
    const resolvedDmsId = String(dmsId || (link ? link.split('/').pop() : ''));

    const itemFolder =
        includeDMSID === 'prefix' ? `[${resolvedDmsId}] ${title}` :
            includeDMSID === 'suffix' ? `${title} [${resolvedDmsId}]` :
                title;

    const subFolder = folder || '';
    const baseFolder = [rootFolder, subFolder, itemFolder].filter(Boolean).join('/');

    const indexPath = [rootFolder, subFolder, 'list.txt'].filter(Boolean).join('/');

    const indexLines = [];
    const output = [];
    let success = true;

    const resolveUrl = (att) => {
        const u = att?.url;
        if (!u) return null;
        return u.startsWith('http') ? u : `${APS_BASE(tenant)}${u}`;
    };

    const download = async (att) => {
        if (att?.type && (att.type.extension == null || att.type.extension === '')) att.type.extension = '';

        const ext = att.type?.extension || '';
        const fileName = `${att.resourceName}${ext}`;

        if (filenamesIn && fileName.indexOf(filenamesIn) < 0) return;
        if (filenamesEx && fileName.indexOf(filenamesEx) >= 0) return;

        const url = resolveUrl(att);
        if (!url) throw new Error(`No attachment.url for: ${fileName}`);

        const buffer = await httpBinaryRequest({
            method: 'GET',
            url,
            headers: { Accept: '*/*' },
            responseType: 'arraybuffer'
        });

        const objectUrl = URL.createObjectURL(
            new Blob([buffer], { type: 'application/octet-stream' })
        );

        const fullPath = `${baseFolder}/${fileName}`;

        try {
            await new Promise((resolve, reject) => {
                chrome.downloads.download(
                    { url: objectUrl, filename: fullPath, conflictAction: 'uniquify', saveAs: false },
                    (id) => (chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(id))
                );
            });
        } finally {
            URL.revokeObjectURL(objectUrl);
        }

        output.push(fullPath);

        if (indexFile) {
            const parts = String(att.selfLink || '').split('/'); // expected indexes: [4]=wsId, [6]=dmsId, [8]=attachmentId
            const line =
                (parts[4] || resolvedWsId) + ';' +
                (parts[6] || resolvedDmsId) + ';' +
                title + ';' +
                (parts[8] || '') + ';' +
                (att.name || '') + ';' +
                (att.version ?? '') + ';' +
                (att.resourceName || '') + ';' +
                ext + ';' +
                (att.type?.fileType || '') + ';' +
                (att.created?.user?.title || '') + ';' +
                (att.created?.timeStamp || '') + ';' +
                (att.size ?? '') + ';' +
                (att.status?.label || '') + ';' +
                fullPath;

            indexLines.push(line);
        }
    };

    await Promise.all(
        attachments.map((att) =>
            download(att).catch(() => {
                success = false;
            })
        )
    );

    if (indexFile && indexLines.length) {
        const header =
            'Workspace ID;DMS ID;Descriptor;' +
            'Attachment ID;Attachment Filename;Attachment Version;' +
            'Attachment Name;Attachment Extension;Attachment Type;' +
            'Created By;Creation Timestamp;Attachment Size;Attachment Status' +
            'Full Path\r\n';

        const objectUrl = URL.createObjectURL(
            new Blob([header + indexLines.join('\r\n') + '\r\n'], { type: 'text/plain' })
        );

        try {
            await new Promise((resolve, reject) => {
                chrome.downloads.download(
                    { url: objectUrl, filename: indexPath, conflictAction: 'uniquify', saveAs: false },
                    (id) => (chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(id))
                );
            });
        } finally {
            URL.revokeObjectURL(objectUrl);
        }

        output.push(indexPath);
    }

    if (!success) {
        const err = new Error('One or more attachments failed to export');
        err.data = output;
        throw err;
    }

    return { data: output };
}

/**
 * Upload one or more attachments to a PLM item.
 *
 * Handles:
 * - Single or multiple files
 * - Folder creation if needed
 * - Existing file versioning
 * - Status update
 * - Controlled concurrency for multiple files
 * - Progress reporting per file
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {string} params.wsId
 * @param {string} params.dmsId
 * @param {File|File[]} params.files
 * @param {string=} params.folderName
 * @param {boolean=} params.updateExisting
 * @param {number=} params.concurrent - Max concurrent uploads (default: 3)
 * @param {function=} params.onProgress - Optional callback(fileName, percent)
 *
 * @returns {Promise<Object[]>} Array of upload results
 */
export async function uploadAttachments({
    tenant,
    wsId,
    dmsId,
    files,
    folderName = '',
    updateExisting = true,
    concurrent = 3,
    onProgress = null
}) {
    if (!files) throw new Error('No files provided');
    const fileList = Array.isArray(files) ? files : [files];
    const results = [];
    const queue = [...fileList];
    const workers = [];

    // Nested helper: upload a single file
    async function uploadFile(file) {
        const attachmentsUrl = `${APS_BASE(tenant)}/api/v3/workspaces/${wsId}/items/${dmsId}/attachments`;

        // Fetch existing attachments once
        const existingAttachments = await httpRequest({ method: 'GET', url: `${attachmentsUrl}?asc=name` })
            .then(res => res.attachments || []);

        // Determine folder
        let folderId = null;
        if (folderName) {
            const existingFolder = existingAttachments.find(a => a.folder?.name === folderName)?.folder;
            folderId = existingFolder?.id || null;

            if (!folderId) {
                const folderResp = await httpRequest({
                    method: 'POST',
                    url: `${APS_BASE(tenant)}/api/v3/workspaces/${wsId}/items/${dmsId}/folders`,
                    body: { folderName }
                });
                folderId = folderResp.headers?.location?.split('/').pop();
            }
        }

        // Determine if file exists
        const existingFile = existingAttachments.find(a => a.name === file.name);
        let fileData;
        let action;

        if (existingFile && updateExisting) {
            // Create new version
            fileData = await httpRequest({
                method: 'POST',
                url: `${attachmentsUrl}/${existingFile.id}`,
                body: { name: file.name, folder: folderId || null, size: file.size }
            });
            action = 'version';
        } else if (!existingFile) {
            // Create new file
            fileData = await httpRequest({
                method: 'POST',
                url: attachmentsUrl,
                body: { name: file.name, folder: folderId || null, size: file.size }
            });
            action = 'new';
        } else {
            return { fileName: file.name, action: 'exists', message: 'File already exists', success: true };
        }

        // Upload binary content
        const uploadResponse = await fetch(fileData.url, {
            method: 'PUT',
            headers: fileData.extraHeaders,
            body: file
        });
        if (!uploadResponse.ok) {
            throw new Error(`Upload failed: HTTP ${uploadResponse.status}`);
        }
        if (onProgress) onProgress(file.name, 100);

        // Set status to CheckIn
        await httpRequest({
            method: 'PATCH',
            url: `${attachmentsUrl}/${fileData.id}`,
            body: { status: { name: 'CheckIn' } }
        });

        return { fileName: file.name, action, message: 'Uploaded successfully', success: true };
    }

    // Worker queue for concurrency
    const worker = async () => {
        while (queue.length) {
            const file = queue.shift();
            try {
                const result = await uploadFile(file);
                results.push(result);
            } catch (err) {
                results.push({ fileName: file.name, action: 'failed', message: err.message, success: false });
            }
        }
    };

    for (let i = 0; i < Math.min(concurrent, fileList.length); i++) {
        workers.push(worker());
    }

    await Promise.all(workers);
    return results;
}

/**
 * Upload a screenshot image as an attachment to a PLM item.
 *
 * @param {Object} params
 * @param {string} params.tenant - Tenant name
 * @param {string} params.wsId - Workspace ID
 * @param {string} params.dmsId - Item DMS ID
 * @param {string} params.imageBase64 - Base64 string of the image
 * @param {string=} params.fileName - Optional filename
 * @param {string=} params.folderName - Optional folder name
 *
 * @returns {Promise<{fileId: string, success: boolean}>}
 */
export async function uploadScreenshot({
   tenant,
   wsId,
   dmsId,
   imageBase64,
   fileName,
   folderName = ''
}) {
    if (!imageBase64) throw new Error('No image provided');

    const attachmentsUrl = `${APS_BASE(tenant)}/api/v3/workspaces/${wsId}/items/${dmsId}/attachments`;

    const finalFileName = fileName || `screenshot-${Date.now()}.jpg`;

    // Convert Base64 to Blob
    const byteString = atob(imageBase64.replace(/^data:image\/\w+;base64,/, ''));
    const buffer = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) buffer[i] = byteString.charCodeAt(i);
    const blob = new Blob([buffer], { type: 'image/jpeg' });

    // Check for existing folder or create it
    let folderId = null;
    if (folderName) {
        const existingAttachments = await httpRequest({ method: 'GET', url: `${attachmentsUrl}?asc=name` });
        const existingFolder = existingAttachments.attachments?.find(a => a.folder?.name === folderName)?.folder;
        folderId = existingFolder?.id || null;

        if (!folderId) {
            const folderResp = await httpRequest({
                method: 'POST',
                url: `${APS_BASE(tenant)}/api/v3/workspaces/${wsId}/items/${dmsId}/folders`,
                body: { folderName }
            });
            folderId = folderResp.headers?.location?.split('/').pop();
        }
    }

    // Create attachment record
    const fileData = await httpRequest({
        method: 'POST',
        url: attachmentsUrl,
        body: {
            description: finalFileName,
            name: finalFileName,
            resourceName: finalFileName,
            folder: folderId || null,
            size: blob.size
        }
    });

    // Upload binary content
    const uploadResponse = await fetch(fileData.url, {
        method: 'PUT',
        headers: fileData.extraHeaders,
        body: blob
    });
    if (!uploadResponse.ok) {
        throw new Error(`Upload failed: HTTP ${uploadResponse.status}`);
    }

    // Set status to "CheckIn"
    await httpRequest({
        method: 'PATCH',
        url: `${attachmentsUrl}/${fileData.id}`,
        body: { status: { name: 'CheckIn' } }
    });

    return { fileId: fileData.id, success: true };
}

/**
 * ATTACHMENT IMPORT (Chrome Extension)
 * Equivalent of POST /import-attachment
 */
export async function importAttachment({
    tenant,
    wsId,
    link = '',
    title = '',
    fieldId,
    fieldValue,
    release = '',
    fileName,
    attachmentsFolder = '',
    includeSuffix = true,
    updateExisting = true,
    logicClause = 'AND',
    file,
    fileDataUrl
}) {

    if (!tenant) throw new Error('tenant is required');
    if (!wsId && !link) throw new Error('wsId or link is required');

    const resolvedFileName =
        fileName ||
        (file && typeof file.name === 'string' ? file.name : '');

    if (!resolvedFileName) throw new Error('fileName is required');

    if (!file && !(typeof fileDataUrl === 'string' && fileDataUrl.startsWith('data:'))) {
        throw new Error('file (File/Blob) or fileDataUrl (data:...base64) is required');
    }

    const fileBlob = file instanceof Blob
        ? file
        : (() => {
            const base64Payload = fileDataUrl.split(',')[1] || '';
            const binaryArray = Uint8Array.from(atob(base64Payload), c => c.charCodeAt(0));
            return new Blob([binaryArray], { type: 'application/octet-stream' });
        })();

    const normalizeBoolean = (value, defaultValue) =>
        typeof value === 'undefined' ? defaultValue : (value === true || value === 'true');

    const includeFileSuffix = normalizeBoolean(includeSuffix, true);
    const allowUpdateExisting = normalizeBoolean(updateExisting, true);

    // 1) Resolve target item (search if link not provided)
    const targetItem = await (async () => {

        if (link) {
            const linkParts = String(link).split('/');
            return {
                wsId: linkParts[4],
                dmsId: linkParts[6],
                link,
                title
            };
        }

        if (!fieldId) {
            throw new Error('fieldId is required when link is not provided');
        }

        let resolvedFieldValue = (fieldValue ?? resolvedFileName);

        if (!includeFileSuffix) {
            const suffixIndex = String(resolvedFieldValue).lastIndexOf('.');
            if (suffixIndex > -1) {
                resolvedFieldValue = String(resolvedFieldValue).slice(0, suffixIndex);
            }
        }

        const searchParams = {
            pageNo: 1,
            pageSize: 1,
            logicClause,
            fields: [
                { fieldID: 'DESCRIPTOR', fieldTypeID: 15 }
            ],
            filter: [],
            sort: [
                { fieldID: 'DESCRIPTOR', fieldTypeID: 15, sortDescending: false }
            ]
        };

        const primaryFilter = {
            fieldID: fieldId,
            filterType: { filterID: 2 },
            fieldTypeID: 0,
            filterValue: resolvedFieldValue
        };

        if (fieldId === 'DESCRIPTOR') {
            primaryFilter.fieldID = 'DESCRIPTOR';
            primaryFilter.fieldTypeID = 15;
        } else {
            searchParams.fields.push({ fieldID: fieldId, fieldTypeID: 0 });
        }

        searchParams.filter.push(primaryFilter);

        if (release) {
            const releaseFilter = {
                fieldID: 'WORKING',
                fieldTypeID: 10,
                filterValue: ''
            };

            releaseFilter.filterType = {
                filterID: release === 'r' ? 14 : 13
            };

            searchParams.filter.push(releaseFilter);

            if (release === 'r') {
                searchParams.filter.push({
                    fieldID: 'LATEST_RELEASE',
                    fieldTypeID: 10,
                    filterType: { filterID: 13 },
                    filterValue: ''
                });
            }
        }

        const searchResponse = await httpRequest({
            method: 'POST',
            url: `${APS_BASE(tenant)}f/api/rest/v1/workspaces/${wsId}/items/search`,
            body: searchParams
        });

        const firstRow = searchResponse?.row?.[0];
        if (!firstRow) return { noMatch: true };

        let descriptorTitle = '';
        for (const fieldEntry of firstRow?.fields?.entry || []) {
            if (fieldEntry.key === 'DESCRIPTOR') {
                descriptorTitle = fieldEntry.fieldData?.value || '';
                break;
            }
        }

        return {
            wsId: String(wsId),
            dmsId: String(firstRow.dmsId),
            link: `/api/v3/workspaces/${wsId}/items/${firstRow.dmsId}`,
            title: descriptorTitle
        };
    })();

    if (targetItem.noMatch) {
        return {
            data: [],
            status: 204,
            message: `No match for ${resolvedFileName}`
        };
    }

    // 2) Load existing attachments
    const attachmentsBaseUrl = `${APS_BASE(tenant)}${targetItem.link}/attachments`;

    const attachmentsResponse = await httpRequest({
        method: 'GET',
        url: `${attachmentsBaseUrl}?asc=name`,
        headers: {
            Accept: 'application/vnd.autodesk.plm.attachments.bulk+json'
        }
    });

    const attachmentList =
        (attachmentsResponse === '' || !attachmentsResponse)
            ? []
            : (attachmentsResponse.attachments || []);

    const existingAttachment =
        attachmentList.find(attachment => attachment?.name === resolvedFileName) || null;

    // 3) Resolve (or create) attachment folder
    let attachmentFolderId = null;

    if (attachmentsFolder) {
        attachmentFolderId =
            attachmentList.find(
                attachment => attachment?.folder?.name === attachmentsFolder
            )?.folder?.id || null;

        if (!attachmentFolderId) {
            const createdFolder = await httpRequest({
                method: 'POST',
                url: `${APS_BASE(tenant)}/api/v3/workspaces/${targetItem.wsId}/items/${targetItem.dmsId}/folders`,
                body: { folderName: attachmentsFolder }
            });

            attachmentFolderId =
                createdFolder?.id || createdFolder?.folderId || null;
        }
    }

    const attachmentFolderObject =
        attachmentFolderId ? { id: String(attachmentFolderId) } : null;

    // 4) Exists → skip
    if (existingAttachment && !allowUpdateExisting) {
        return {
            data: {
                title: targetItem.title,
                link: targetItem.link,
                action: 'exists',
                message: 'No action, file exits'
            }
        };
    }

    // 5) Create file record or version
    const isVersionUpload = Boolean(existingAttachment);
    const attachmentCreateUrl = isVersionUpload ? `${attachmentsBaseUrl}/${existingAttachment.id}` : attachmentsBaseUrl;

    const attachmentCreatePayload = isVersionUpload
        ? {
            description: resolvedFileName,
            fileName: resolvedFileName,
            name: resolvedFileName,
            resourceName: resolvedFileName,
            folder: attachmentFolderObject,
            fileTypeString: 'file/type',
            size: fileBlob.size
        }
        : {
            description: resolvedFileName,
            name: resolvedFileName,
            resourceName: resolvedFileName,
            folder: attachmentFolderObject,
            size: fileBlob.size
        };

    const createdAttachment = await httpRequest({
        method: 'POST',
        url: attachmentCreateUrl,
        body: attachmentCreatePayload
    });

    // 6) Upload binary to pre-signed URL
    const uploadResponse = await fetch(String(createdAttachment.url), {
        method: 'PUT',
        headers: createdAttachment.extraHeaders || {},
        body: fileBlob
    });

    if (!uploadResponse.ok) {
        throw new Error(`Upload failed: HTTP ${uploadResponse.status}`);
    }

    // 7) Check in
    await httpRequest({
        method: 'PATCH',
        url: `${attachmentsBaseUrl}/${createdAttachment.id}`,
        body: { status: { name: 'CheckIn' } }
    });

    const finalAction =
        isVersionUpload
            ? 'version'
            : (attachmentsFolder
                ? (attachmentFolderId ? 'new file in folder' : 'new folder')
                : 'new');

    const finalMessage =
        isVersionUpload
            ? 'Version created'
            : (attachmentsFolder
                ? (attachmentFolderId
                    ? 'Uploaded new file to existing folder'
                    : 'Uploaded new file to new folder')
                : 'New file uploaded');

    return {
        data: {
            title: targetItem.title,
            link: targetItem.link,
            action: finalAction,
            message: finalMessage
        }
    };
}



/**
 * GET SINGLE VIEWABLE TO INIT APS VIEWER
 *
 * Equivalent of GET /get-viewable
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.wsId
 * @param {number=} params.dmsId
 * @param {string=} params.link
 * @param {string=} params.attachmentId
 * @param {string|boolean=} params.forceUpdate
 * @param {string|boolean=} params.isPDF
 */
export async function getViewable({
                                      tenant,
                                      wsId,
                                      dmsId,
                                      link,
                                      attachmentId,
                                      forceUpdate,
                                      isPDF,
                                  }) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    const force = (typeof forceUpdate === 'undefined') ? false : (forceUpdate == 'true');
    const pdf = (typeof isPDF === 'undefined') ? false : (isPDF == 'true');
    const itemLink = (typeof link === 'undefined') ? `/api/v3/workspaces/${wsId}/items/${dmsId}` : link;

    let url = `${itemLink.startsWith('http') ? itemLink : `${APS_BASE(tenant)}` + itemLink}`;

    if (pdf) {
        return { data: { status: 'DONE' } };
    }

    if (url.indexOf('/attachments/') === -1) {
        url += `/attachments/${attachmentId}`;
    }

    if (force) {
        url += '?force=true';
    }

    const headers = {
        Accept: 'application/vnd.autodesk.plm.attachment.viewable+json'
    };

    try {
        const response = await httpRequest({
            method: 'GET',
            url,
            headers
        });
        return response;
    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * GET ALL VIEWABLES TO INIT APS VIEWER
 *
 * Equivalent of POST /get-viewables
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.wsId
 * @param {number=} params.dmsId
 * @param {string=} params.link
 * @param {string=} params.fileId
 * @param {string=} params.filename
 * @param {Array<string>=} params.suffixPrimaryFile
 * @param {Array<string>=} params.extensionsIn
 * @param {Array<string>=} params.extensionsEx
 *
 * @returns {Object}
 * @returns {Array<Object>} returns.data
 */

export async function getViewables({
   tenant,
   wsId,
   dmsId,
   link,
   fileId,
   filename,
   suffixPrimaryFile = ['.iam.dwf', '.iam.dwfx', '.ipt.dwf', '.ipt.dwfx'],
   extensionsIn = ['dwf', 'dwfx', 'nwd', 'iam', 'ipt', 'stp', 'step', 'sldprt', 'pdf'],
   extensionsEx = []
}) {
    if (!tenant) throw new Error('tenant is required');

    const resolvedLink = (typeof link === 'undefined') ? `/api/v3/workspaces/${wsId}/items/${dmsId}` : link;
    const attachmentsBaseUrl = `${resolvedLink.startsWith('http') ? resolvedLink : `${APS_BASE(tenant)}` + resolvedLink}/attachments`;
    const resolvedFileId = (typeof fileId === 'undefined') ? '' : fileId;
    const resolvedFilename = (typeof filename === 'undefined') ? '' : filename;

    const bulkHeaders = {
        Accept: 'application/vnd.autodesk.plm.attachments.bulk+json'
    };

    try {
        const attachmentsListResponse = await httpRequest({
            method: 'GET',
            url: `${attachmentsBaseUrl}?asc=name`,
            headers: bulkHeaders
        });

        const attachmentsListData = attachmentsListResponse?.data ?? attachmentsListResponse;
        const attachmentsListStatus = attachmentsListResponse?.status;

        if (attachmentsListData !== '') {

            let viewables = [];
            let requests = [];
            let primarySuffixIndex = 1000;

            const viewableHeaders = {
                Accept: 'application/vnd.autodesk.plm.attachment.viewable+json'
            };

            const attachmentsArray = attachmentsListData?.attachments || [];

            for (let attachmentIndex = 0; attachmentIndex < attachmentsArray.length; attachmentIndex++) {

                const attachment = attachmentsArray[attachmentIndex];

                if (attachment.type.extension !== null) {

                    let include = false;
                    let primary = false;

                    let attachmentExtension = attachment.type.extension.toLowerCase().split('.').pop();
                    attachmentExtension = attachmentExtension.toLowerCase();

                    if (resolvedFileId !== resolvedFilename) {
                        if ((attachment.id === resolvedFileId) || (attachment.resourceName == resolvedFilename)) {
                            include = true;
                            primary = true;
                        }
                    } else if (extensionsIn.length === 0 || extensionsIn.includes(attachmentExtension)) {
                        if (extensionsEx.length === 0 || !extensionsEx.includes(attachmentExtension)) {
                            include = true;

                            for (let suffixIndex in suffixPrimaryFile) {
                                const primarySuffix = suffixPrimaryFile[suffixIndex];

                                if (attachment.name.endsWith(primarySuffix)) {
                                    if (suffixIndex < primarySuffixIndex) {
                                        primarySuffixIndex = suffixIndex;
                                        primary = true;
                                        for (let existingViewable of viewables) existingViewable.primary = false;
                                    }
                                }
                            }
                        }
                    }

                    if (include) {

                        viewables.push({
                            id: attachment.id,
                            name: attachment.name,
                            resourceName: attachment.resourceName,
                            description: attachment.description,
                            version: attachment.version,
                            user: attachment.created.user.title,
                            type: attachment.type.fileType,
                            extension: attachment.type.extension,
                            primary: primary,
                            size: attachment.size,
                            thumbnail: attachment.thumbnails.large,
                            timestamp: attachment.created.timeStamp,
                            token: '',
                            status: '',
                            urn: ''
                        });

                        if (attachment.type.fileType != 'Adobe PDF') {
                            requests.push(httpRequest({
                                method: 'GET',
                                url: `${attachmentsBaseUrl}/${attachment.id}`,
                                headers: viewableHeaders
                            }));
                        }

                    }

                }
            }

            const viewableResponses = await Promise.all(requests);

            let hasPrimary = false;

            for (let viewable of viewables) {

                if (viewable.primary) hasPrimary = true;

                for (let viewableResponse of viewableResponses) {

                    const viewableResponseData = viewableResponse?.data ?? viewableResponse;

                    if (
                        (viewable.name === viewableResponseData?.fileName) ||
                        ((viewable.name + viewable.extension) === viewableResponseData?.fileName)
                    ) {
                        viewable.status = viewableResponseData?.status;
                        viewable.urn = viewableResponseData?.fileUrn;
                    }
                }

                if (viewable.type == 'Adobe PDF') {
                    viewable.filename = viewable.name.split('.pdf')[0] + '-V' + viewable.version + '.pdf';
                    viewable.link = '';
                    viewable.status = 'DONE';
                }

            }

            if (viewables.length > 0) {
                if (!hasPrimary) viewables[0].primary = true;
            }

            return { data: viewables };

        } else {
            return { data: [], status: attachmentsListStatus };
        }

    } catch (error) {
        return error?.response ?? error;
    }
}

function getBomViewsListEndpoint(tenant, workspaceId) {
    return `${APS_BASE(tenant)}/api/v3/workspaces/${workspaceId}/views/5`;
}

function extractBomViewsFromListResponse(response) {
    const data =
        response && typeof response === 'object' && response.data && typeof response.data === 'object'
            ? response.data
            : response;
    const fromRoot = Array.isArray(data?.bomViews) ? data.bomViews : [];
    if (fromRoot.length > 0) return fromRoot;
    const nestedData = data && typeof data.data === 'object' ? data.data : null;
    const fromNested = Array.isArray(nestedData?.bomViews) ? nestedData.bomViews : [];
    if (fromNested.length > 0) return fromNested;
    return Array.isArray(response?.bomViews) ? response.bomViews : [];
}

function parseBomViewDefIdFromLink(value) {
    const text = String(value || '').trim();
    if (!text) return null;
    const match = /\/viewdef\/(\d+)(?:[/?#]|$)/i.exec(text);
    if (!match) return null;
    const parsed = Number(match[1]);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.floor(parsed);
}

function parseBomViewDefId(entry) {
    if (!entry || typeof entry !== 'object') return null;
    const linkCandidates = [];
    if (typeof entry.link === 'string') linkCandidates.push(entry.link);
    if (typeof entry.__self__ === 'string') linkCandidates.push(entry.__self__);
    if (entry.__self__ && typeof entry.__self__ === 'object') {
        if (typeof entry.__self__.link === 'string') linkCandidates.push(entry.__self__.link);
        if (typeof entry.__self__.urn === 'string') linkCandidates.push(entry.__self__.urn);
    }
    if (typeof entry.urn === 'string') linkCandidates.push(entry.urn);

    for (const candidate of linkCandidates) {
        const parsed = parseBomViewDefIdFromLink(candidate);
        if (parsed !== null) return parsed;
    }

    const directCandidates = [
        entry.viewDefId,
        entry.viewdefid,
        entry.viewdefId,
        entry.id
    ];
    for (const candidate of directCandidates) {
        const parsed = Number(candidate);
        if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed);
    }
    return null;
}

function buildBomViewDefLink(workspaceId, viewDefId) {
    return `/api/v3/workspaces/${workspaceId}/views/5/viewdef/${viewDefId}`;
}

function toTenantUrl(tenant, path) {
    const raw = String(path || '').trim();
    if (!raw) return '';
    return raw.startsWith('http') ? raw : `${APS_BASE(tenant)}${raw}`;
}

function resolveBomViewLink(entry) {
    if (!entry || typeof entry !== 'object') return '';
    if (typeof entry.link === 'string' && entry.link.trim()) return entry.link.trim();
    if (entry.__self__ && typeof entry.__self__ === 'object') {
        const link = String(entry.__self__.link || '').trim();
        if (link) return link;
    }
    if (typeof entry.__self__ === 'string' && entry.__self__.trim()) return entry.__self__.trim();
    return '';
}

function normalizeBomViews(entries, workspaceId) {
    const normalized = [];
    const seen = new Set();

    for (const entry of entries) {
        if (!entry || typeof entry !== 'object') continue;
        if (entry.deleted === true) continue;
        const viewDefId = parseBomViewDefId(entry);
        const fallbackLink = viewDefId ? buildBomViewDefLink(workspaceId, viewDefId) : '';
        const resolvedLink = resolveBomViewLink(entry) || fallbackLink;
        const key = viewDefId ? `id:${viewDefId}` : `link:${resolvedLink}`;
        if (!resolvedLink || seen.has(key)) continue;
        seen.add(key);

        normalized.push({
            id: viewDefId,
            name: String(entry.name || entry.title || '').trim(),
            isDefault: Boolean(entry.isDefault),
            link: resolvedLink,
            urn: String(entry.urn || (entry.__self__ && typeof entry.__self__ === 'object' ? entry.__self__.urn || '' : '') || '').trim()
        });
    }

    return normalized;
}

async function mapWithConcurrency(items, concurrency, worker) {
    if (!Array.isArray(items) || items.length === 0) return [];
    const safeConcurrency = Math.max(1, Math.min(Number(concurrency) || 1, items.length));
    const results = new Array(items.length);
    let nextIndex = 0;

    const runWorker = async () => {
        while (nextIndex < items.length) {
            const currentIndex = nextIndex;
            nextIndex += 1;
            results[currentIndex] = await worker(items[currentIndex], currentIndex);
        }
    };

    await Promise.all(Array.from({ length: safeConcurrency }, () => runWorker()));
    return results;
}

function extractFieldsFromResponsePayload(payload) {
    if (!payload) return [];

    const data =
        payload && typeof payload === 'object' && payload.data && typeof payload.data === 'object'
            ? payload.data
            : payload;

    if (Array.isArray(data?.fields)) return data.fields;
    if (Array.isArray(data?.viewfields)) return data.viewfields;
    if (Array.isArray(data?.viewFields)) return data.viewFields;
    if (Array.isArray(data)) return data;
    return [];
}

function resolveValidatorsLink(field) {
    if (!field || typeof field !== 'object') return '';
    if (typeof field.validators === 'string' && field.validators.trim()) return field.validators.trim();
    if (field.validators && typeof field.validators === 'object') {
        const link = String(field.validators.link || '').trim();
        if (link) return link;
    }
    return '';
}

function payloadHasRequiredValidator(value) {
    if (!value) return false;
    if (Array.isArray(value)) return value.some((entry) => payloadHasRequiredValidator(entry));
    if (typeof value !== 'object') return String(value).trim().toLowerCase() === 'required';
    const validatorName = String(value.validatorName || value.name || '').trim().toLowerCase();
    if (validatorName === 'required') return true;
    if (Array.isArray(value.validators)) return value.validators.some((entry) => payloadHasRequiredValidator(entry));
    return false;
}

const VALIDATION_PAYLOAD_CACHE_MAX = 2000;
const validationPayloadCache = new Map();
const validationPayloadInFlight = new Map();

function normalizeValidationCacheKey(tenant, link) {
    const raw = String(link || '').trim();
    if (!raw) return '';

    if (raw.startsWith('http')) {
        try {
            const parsed = new URL(raw);
            return `${tenant}|${parsed.pathname}${parsed.search}`;
        } catch {
            return `${tenant}|${raw}`;
        }
    }

    return `${tenant}|${raw}`;
}

function setValidationPayloadCache(cacheKey, payload) {
    if (!cacheKey) return;
    if (validationPayloadCache.has(cacheKey)) {
        validationPayloadCache.delete(cacheKey);
    }
    validationPayloadCache.set(cacheKey, payload);

    if (validationPayloadCache.size > VALIDATION_PAYLOAD_CACHE_MAX) {
        const oldestKey = validationPayloadCache.keys().next().value;
        if (oldestKey) validationPayloadCache.delete(oldestKey);
    }
}

async function fetchValidationPayloadCached(tenant, link) {
    const cacheKey = normalizeValidationCacheKey(tenant, link);
    if (!cacheKey) return null;

    if (validationPayloadCache.has(cacheKey)) {
        return validationPayloadCache.get(cacheKey);
    }

    if (validationPayloadInFlight.has(cacheKey)) {
        return validationPayloadInFlight.get(cacheKey);
    }

    const requestPromise = (async () => {
        try {
            const response = await httpRequest({
                method: 'GET',
                url: String(link).startsWith('http') ? link : `${APS_BASE(tenant)}${link}`
            });
            setValidationPayloadCache(cacheKey, response);
            return response;
        } catch {
            return null;
        } finally {
            validationPayloadInFlight.delete(cacheKey);
        }
    })();

    validationPayloadInFlight.set(cacheKey, requestPromise);
    return requestPromise;
}

async function hydrateRequiredValidatorsForFieldsResponse(tenant, payload) {
    const fields = extractFieldsFromResponsePayload(payload);
    if (!Array.isArray(fields) || fields.length === 0) return payload;

    const validationDescriptors = [];
    const seenValidationKeys = new Set();
    for (const field of fields) {
        const validatorsLink = resolveValidatorsLink(field);
        if (!validatorsLink) continue;
        const cacheKey = normalizeValidationCacheKey(tenant, validatorsLink);
        if (!cacheKey || seenValidationKeys.has(cacheKey)) continue;
        seenValidationKeys.add(cacheKey);
        validationDescriptors.push({ cacheKey, validatorsLink });
    }
    if (validationDescriptors.length === 0) return payload;

    const validationEntries = await mapWithConcurrency(
        validationDescriptors,
        10,
        async ({ cacheKey, validatorsLink }) => {
            const response = await fetchValidationPayloadCached(tenant, validatorsLink);
            return [cacheKey, response];
        }
    );

    const validationByLink = new Map(validationEntries);

    for (const field of fields) {
        const validatorsLink = resolveValidatorsLink(field);
        if (!validatorsLink) {
            field.required = Boolean(field.required);
            continue;
        }

        const cacheKey = normalizeValidationCacheKey(tenant, validatorsLink);
        const validationPayload = validationByLink.get(cacheKey);
        const validations = Array.isArray(validationPayload)
            ? validationPayload
            : Array.isArray(validationPayload?.data)
                ? validationPayload.data
                : [];

        field.validations = validations;
        field.required = Boolean(field.required) || payloadHasRequiredValidator(validations);
    }

    return payload;
}

/**
 * BOM VIEWS LIST
 *
 * Equivalent of GET /bom-views
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.wsId
 * @param {string=} params.link
 * @param {string|boolean=} params.useCache
 *
 * @returns {Object}
 * @returns {Object} returns.data
 */
export async function getBomViews({
                                      tenant,
                                      wsId,
                                      link,
                                      useCache
                                  }) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    const resolvedWorkspaceId = (typeof link !== 'undefined') ? link.split('/')[4] : wsId;
    const viewsUrl = getBomViewsListEndpoint(tenant, resolvedWorkspaceId);

    try {
        const viewsResponse = await httpRequest({
            method: 'GET',
            url: viewsUrl
        });

        const result = normalizeBomViews(
            extractBomViewsFromListResponse(viewsResponse),
            resolvedWorkspaceId
        );
        result.sort((left, right) => Number(left?.id || 0) - Number(right?.id || 0));

        const response = {
            ...viewsResponse,
            data: {
                ...(viewsResponse && viewsResponse.data && typeof viewsResponse.data === 'object' ? viewsResponse.data : {}),
                bomViews: result,
                count: result.length
            }
        };

        return response;

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * BOM VIEWS DETAILS
 *
 * Equivalent of GET /bom-views-and-fields
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.wsId
 * @param {string=} params.link
 * @param {string|boolean=} params.useCache
 *
 * @returns {Object}
 * @returns {Array<Object>} returns.data
 */
export async function getBomViewsAndFields({
   tenant,
   wsId,
   link,
   useCache
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    const resolvedWorkspaceId =
        (typeof link !== 'undefined') ? link.split('/')[4] : wsId;
    const viewsUrl = getBomViewsListEndpoint(tenant, resolvedWorkspaceId);

    try {
        const viewsResponse = await httpRequest({
            method: 'GET',
            url: viewsUrl
        });

        const listedViews = normalizeBomViews(
            extractBomViewsFromListResponse(viewsResponse),
            resolvedWorkspaceId
        );

        const result = await mapWithConcurrency(
            listedViews,
            10,
            async (view) => {
                let fields = null;
                const viewFieldsLink = String(view.link || '').endsWith('/fields')
                    ? String(view.link || '')
                    : `${String(view.link || '')}/fields`;
                try {
                    fields = await httpRequest({
                        method: 'GET',
                        url: toTenantUrl(tenant, viewFieldsLink)
                    });
                    fields = await hydrateRequiredValidatorsForFieldsResponse(tenant, fields);
                } catch {
                    fields = null;
                }

                const id = parseBomViewDefId(view || {});
                const linkValue = resolveBomViewLink(view || {});
                const urnValue = String(view.urn || '').trim();

                return {
                    data: {
                        id,
                        name: String(view.name || '').trim(),
                        isDefault: view.isDefault === true,
                        link: linkValue,
                        urn: urnValue,
                        __self__: {
                            link: linkValue,
                            urn: urnValue
                        }
                    },
                    fields
                };
            }
        );

        result.sort((left, right) => Number(left?.data?.id || 0) - Number(right?.data?.id || 0));

        return { data: result };

    } catch (error) {
        return {
            status: Number(error?.status) || 500,
            message: error instanceof Error ? error.message : String(error || ''),
            data: error?.data ?? null
        };
    }
}

/**
 * BOM VIEW COLUMNS
 *
 * Equivalent of GET /bom-view-fields
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {string=} params.link
 * @param {number=} params.wsId
 * @param {number=} params.viewId
 */
export async function getBomViewFields({
    tenant,
    link,
    wsId,
    viewId
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    let url = (typeof link !== 'undefined') ? link : `/api/v3/workspaces/${wsId}/views/5/viewdef/${viewId}`;
    if (!String(url).endsWith('/fields')) {
        url = `${url}/fields`;
    }
    url = `${url.startsWith('http') ? url : `${APS_BASE(tenant)}` + url}`;

    try {
        let response = await httpRequest({
            method: 'GET',
            url
        });
        response = await hydrateRequiredValidatorsForFieldsResponse(tenant, response);
        return response;
    } catch (error) {
        return {
            status: Number(error?.status) || 500,
            message: error instanceof Error ? error.message : String(error || ''),
            data: error?.data ?? null
        };
    }
}

/**
 * GET BOM VIEW BY NAME
 *
 * Equivalent of GET /bom-view-by-name
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.wsId
 * @param {string=} params.link
 * @param {string} params.name
 * @param {string|boolean=} params.useCache
 *
 * @returns {Object}
 * @returns {Object|null} returns.data
 */
export async function getBomViewByName({
                                           tenant,
                                           wsId,
                                           link,
                                           name,
                                           useCache
                                       }) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    const resolvedWorkspaceId = (typeof link !== 'undefined') ? link.split('/')[4] : wsId;
    const viewsUrl = getBomViewsListEndpoint(tenant, resolvedWorkspaceId);

    try {
        const viewsResponse = await httpRequest({
            method: 'GET',
            url: viewsUrl
        });

        const listedViews = normalizeBomViews(
            extractBomViewsFromListResponse(viewsResponse),
            resolvedWorkspaceId
        );

        for (const view of listedViews) {
            try {
                const result = await httpRequest({
                    method: 'GET',
                    url: toTenantUrl(tenant, view.link)
                });
                if (String(result?.name || '').trim() === String(name || '').trim()) {
                    return {
                        data: {
                            id: parseBomViewDefId(result || {}) || view.id,
                            name: result.name,
                            isDefault: result.isDefault === true || view.isDefault === true,
                            link: resolveBomViewLink(result || {}) || view.link,
                            urn: String(
                                (result?.__self__ && typeof result.__self__ === 'object' ? result.__self__.urn : result?.urn)
                                || view.urn
                                || ''
                            ).trim()
                        }
                    };
                }
            } catch {
                if (String(view.name || '').trim() === String(name || '').trim()) {
                    return { data: view };
                }
            }
        }

        return { data: null };

    } catch (error) {
        return {
            status: Number(error?.status) || 500,
            message: error instanceof Error ? error.message : String(error || ''),
            data: error?.data ?? null
        };
    }
}

/**
 * Fetch linkable items for BOM validation.
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number|string} params.workspaceId
 * @param {number|string} params.currentItemId
 * @param {number|string} params.viewId
 *
 * @returns {Object}
 */
export async function fetchBomLinkableItems({
    tenant,
    workspaceId,
    currentItemId,
    viewId,
    relatedWorkspaceId,
    search = '',
    sort = '',
    limit = 100,
    offset = 0
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }
    if (!workspaceId || !currentItemId || !viewId) {
        throw new Error('workspaceId, currentItemId, and viewId are required');
    }

    const query = new URLSearchParams();
    query.set('limit', String(limit));
    query.set('offset', String(offset));
    if (relatedWorkspaceId) query.set('relatedWorkspaceId', String(relatedWorkspaceId));
    if (search) query.set('search', String(search));
    if (sort) query.set('sort', String(sort));

    const url =
        `${APS_BASE(tenant)}/api/v3/workspaces/${workspaceId}/items/${currentItemId}/views/${viewId}/linkable-items?${query.toString()}`;

    const response = await httpRequest({
        method: 'GET',
        url
    });

    if (response.data === '') {
        response.data = { items: [] };
    }

    if (!Array.isArray(response?.data?.items) && Array.isArray(response?.data?.linkableItems)) {
        response.data.items = response.data.linkableItems;
    }

    return response;
}

/**
 * BOM DATA
 *
 * Equivalent of GET /bom
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.wsId
 * @param {number=} params.dmsId
 * @param {string=} params.link
 * @param {number|string=} params.depth
 * @param {string=} params.revisionBias
 * @param {string=} params.effectiveDate
 * @param {number|string=} params.viewId
 * @param {string|boolean=} params.getBOMPartsList
 *
 * @returns {Object}
 */
export async function getBom({
     tenant,
     wsId,
     dmsId,
     link,
     depth,
     revisionBias,
     effectiveDate,
     viewId,
     getBOMPartsList
 }) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    const resolvedRevisionBias = (typeof revisionBias !== 'undefined') ? revisionBias : 'release';
    const resolvedDepth = (typeof depth !== 'undefined') ? depth : 10;
    const resolvedGetPartsList = (typeof getBOMPartsList !== 'undefined') ? getBOMPartsList : false;
    const resolvedLink = (typeof link !== 'undefined') ? link : `/api/v3/workspaces/${wsId}/items/${dmsId}`;
    const rootId = (typeof link !== 'undefined') ? String(link).split('/')[6] : dmsId;

    const buildUrl = () => {
        let requestUrl = `${resolvedLink.startsWith('http') ? resolvedLink : `${APS_BASE(tenant)}` + resolvedLink}` + `/bom?depth=${resolvedDepth}&revisionBias=${resolvedRevisionBias}&rootId=${rootId}`;
        if (typeof viewId !== 'undefined') requestUrl += `&viewDefId=${viewId}`;
        if (typeof effectiveDate !== 'undefined') requestUrl += `&effectiveDate=${effectiveDate}`;
        return requestUrl;
    };

    const headers = {
        Accept: 'application/vnd.autodesk.plm.bom.bulk+json'
    };

    try {
        const response = await httpRequest({
            method: 'GET',
            url: buildUrl(),
            headers
        });

        let payload =
            response && typeof response === 'object' && response.data && typeof response.data === 'object'
                ? response.data
                : response;

        if (payload && typeof payload === 'object' && Array.isArray(payload.edges)) {
            sortArray(payload.edges, 'itemNumber', '');
            sortArray(payload.edges, 'depth', '');
        }

        if (resolvedGetPartsList) {
            const workspaceId = resolvedLink.split('/')[4];
            const urlFields = `${APS_BASE(tenant)}/api/v3/workspaces/${workspaceId}/views/5/viewdef/${viewId}/fields`;
            const bomViewFields = await httpRequest({
                method: 'GET',
                url: urlFields
            });

            const bomViewFieldsPayload =
                bomViewFields && typeof bomViewFields === 'object' && Array.isArray(bomViewFields.data)
                    ? bomViewFields.data
                    : bomViewFields;

            if (payload && typeof payload === 'object') {
                payload.bomPartsList = getBOMPartsList(
                    payload,
                    bomViewFieldsPayload,
                    null
                );
            }
        }

        // Keep backward compatibility with callers that expect { data: ... }.
        if (response && typeof response === 'object' && response.data && typeof response.data === 'object') {
            response.data = payload;
            return response;
        }

        return { data: payload };
    } catch (error) {
        throw error;
    }
}

/**
 * FLAT BOM DATA
 *
 * Equivalent of GET /bom-flat
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.wsId
 * @param {number=} params.dmsId
 * @param {string=} params.link
 * @param {string=} params.revisionBias
 * @param {number|string=} params.viewId
 *
 * @returns {Object}
 * @returns {Array<Object>} returns.data
 * @returns {number=} returns.status
 */
export async function getBomFlat({
     tenant,
     wsId,
     dmsId,
     link,
     revisionBias,
     viewId
 }) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    const resolvedLink = (typeof link !== 'undefined') ? link : `/api/v3/workspaces/${wsId}/items/${dmsId}`;
    const resolvedDmsId = (typeof dmsId !== 'undefined') ? dmsId : resolvedLink.split('/')[6];
    const url = `${resolvedLink.startsWith('http') ? resolvedLink : `${APS_BASE(tenant)}` + resolvedLink}` + `/bom-items?revisionBias=${revisionBias}&rootId=${resolvedDmsId}&viewDefId=${viewId}`;

    const headers = {
        accept: 'application/vnd.autodesk.plm.bom.flat.bulk+json'
    };

    try {
        const response = await httpRequest({
            method: 'GET',
            url,
            headers
        });

        let result = [];
        if (response.data !== '') result = response.data.flatItems;

        return { data: result, status: response.status };

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * GET BOM ITEM / EDGE
 *
 * Equivalent of GET /bom-item
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.wsId
 * @param {number=} params.dmsId
 * @param {string|number=} params.edgeId
 * @param {string=} params.link
 *
 * @returns {Object}
 */
export async function getBomItem({
    tenant,
    wsId,
    dmsId,
    edgeId,
    link
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    let url = (typeof link !== 'undefined') ? link : `/api/v3/workspaces/${wsId}/items/${dmsId}/bom-items/${edgeId}`;

    url = url.startsWith('http') ? url : `${APS_BASE(tenant)}` + url;

    try {
        const response = await httpRequest({
            method: 'GET',
            url
        });
        return response;
    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * GET BOM EDGE
 *
 * Equivalent of GET /bom-edge
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {string} params.edgeLink
 *
 * @returns {Object}
 */
export async function getBomEdge({
     tenant,
     edgeLink
 }) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    let url = edgeLink;

    url = url.startsWith('http') ? url : `${APS_BASE(tenant)}` + edgeLink;

    try {
        const response = await httpRequest({
            method: 'GET',
            url
        });
        return response;
    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * ADD BOM ITEM
 *
 * Equivalent of POST /bom-add
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.wsIdParent
 * @param {number=} params.wsIdChild
 * @param {number=} params.dmsIdParent
 * @param {number=} params.dmsIdChild
 * @param {string=} params.linkParent
 * @param {string=} params.linkChild
 * @param {string|number=} params.quantity
 * @param {string|boolean=} params.pinned
 * @param {string|number=} params.number
 * @param {Array<Object>=} params.fields
 *
 * @returns {Object}
 * @returns {string=} returns.data
 * @returns {number=} returns.status
 */
export async function addBomItem({
     tenant,
     wsIdParent,
     wsIdChild,
     dmsIdParent,
     dmsIdChild,
     linkParent,
     linkChild,
     quantity,
     pinned,
     number,
     fields
 }) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    const resolvedLinkParent = (typeof linkParent !== 'undefined') ? linkParent : `/api/v3/workspaces/${wsIdParent}/items/${dmsIdParent}`;
    const resolvedLinkChild = (typeof linkChild !== 'undefined') ? linkChild : `/api/v3/workspaces/${wsIdChild}/items/${dmsIdChild}`;
    const isPinned = (typeof pinned === 'undefined') ? false : (String(pinned).toLowerCase() === 'true');
    const resolvedQuantity = (typeof quantity === 'undefined') ? 1 : quantity;
    const url = `${APS_BASE(tenant)}${resolvedLinkParent}/bom-items`;

    const params = {
        quantity: parseFloat(resolvedQuantity),
        isPinned: isPinned,
        item: {
            link: resolvedLinkChild
        }
    };

    if (typeof number !== 'undefined') {
        params.itemNumber = Number(number);
    }

    if (typeof fields !== 'undefined' && fields.length > 0) {
        params.fields = [];

        for (let field of fields) {
            params.fields.push({
                metaData: {
                    link: field.link
                },
                value: field.value
            });
        }
    }

    try {
        const response = await httpRequest({
            method: 'POST',
            url,
            body: params
        });

        const resolvedStatus = Number(response?.status);
        return {
            data: true,
            status: Number.isFinite(resolvedStatus) ? resolvedStatus : 200
        };

    } catch (error) {
        return {
            status: Number(error?.status) || 500,
            message: error instanceof Error ? error.message : String(error || ''),
            data: error?.data ?? null
        };
    }
}

/**
 * BOM DATA (v1)
 *
 * Equivalent of GET /api/rest/v1/workspaces/{wsId}/items/{dmsId}/boms
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number|string} params.wsId
 * @param {number|string} params.dmsId
 * @param {number|string=} params.depth
 *
 * @returns {Object}
 */
export async function getBomV1({
    tenant,
    wsId,
    dmsId,
    depth
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    if (!wsId) {
        throw new Error('wsId is required');
    }

    if (!dmsId) {
        throw new Error('dmsId is required');
    }

    const resolvedDepth = (typeof depth !== 'undefined') ? depth : 100;
    const url = `${APS_BASE(tenant)}/api/rest/v1/workspaces/${wsId}/items/${dmsId}/boms?depth=${resolvedDepth}`;

    return httpRequest({
        method: 'GET',
        url,
        headers: {
            Accept: 'application/json'
        }
    });
}

/**
 * UPDATE BOM ITEM
 *
 * Equivalent of POST /bom-update
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.wsIdParent
 * @param {number=} params.wsIdChild
 * @param {number=} params.dmsIdParent
 * @param {number=} params.dmsIdChild
 * @param {string=} params.linkParent
 * @param {string=} params.linkChild
 * @param {string|number} params.edgeId
 * @param {string|number=} params.quantity
 * @param {string|boolean=} params.pinned
 * @param {string|number=} params.number
 * @param {Array<Object>=} params.fields
 *
 * @returns {Object}
 * @returns {boolean=} returns.data
 * @returns {number=} returns.status
 */
export async function updateBomItem({
    tenant,
    wsIdParent,
    wsIdChild,
    dmsIdParent,
    dmsIdChild,
    linkParent,
    linkChild,
    edgeId,
    quantity,
    pinned,
    number,
    fields
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    const resolvedLinkParent = (typeof linkParent !== 'undefined') ? linkParent : `/api/v3/workspaces/${wsIdParent}/items/${dmsIdParent}`;
    const resolvedLinkChild = (typeof linkChild !== 'undefined') ? linkChild : `/api/v3/workspaces/${wsIdChild}/items/${dmsIdChild}`;
    const isPinned = (typeof pinned === 'undefined') ? false : (String(pinned).toLowerCase() === 'true');
    const resolvedQuantity = (typeof quantity === 'undefined') ? 1 : quantity;
    const url = `${APS_BASE(tenant)}${resolvedLinkParent}/bom-items/${edgeId}`;

    const params = {
        quantity: parseFloat(resolvedQuantity),
        isPinned: isPinned,
        item: {
            link: resolvedLinkChild
        }
    };

    if (typeof number !== 'undefined') {
        params.itemNumber = Number(number);
    }

    if (typeof fields !== 'undefined' && fields.length > 0) {
        params.fields = [];

        for (let field of fields) {
            params.fields.push({
                metaData: {
                    link: field.link
                },
                value: field.value
            });
        }
    }

    try {
        const response = await httpRequest({
            method: 'PATCH',
            url,
            body: params
        });

        const resolvedStatus = Number(response?.status);
        return {
            data: true,
            status: Number.isFinite(resolvedStatus) ? resolvedStatus : 200
        };

    } catch (error) {
        return {
            status: Number(error?.status) || 500,
            message: error instanceof Error ? error.message : String(error || ''),
            data: error?.data ?? null
        };
    }
}

/**
 * REMOVE BOM ITEM
 *
 * Equivalent of GET /bom-remove
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.wsId
 * @param {number=} params.dmsId
 * @param {string=} params.link
 * @param {string|number=} params.edgeId
 * @param {string=} params.edgeLink
 *
 * @returns {Object}
 * @returns {boolean=} returns.data
 * @returns {number=} returns.status
 */
export async function removeBomItem({
    tenant,
    wsId,
    dmsId,
    link,
    edgeId,
    edgeLink
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    let resolvedEdgeLink = edgeLink;

    if (typeof resolvedEdgeLink === 'undefined') {
        resolvedEdgeLink = (typeof link !== 'undefined') ? link : `/api/v3/workspaces/${wsId}/items/${dmsId}`;
        resolvedEdgeLink += `/bom-items/${edgeId}`;
    }

    const url = `${resolvedEdgeLink.startsWith('http') ? resolvedEdgeLink : `${APS_BASE(tenant)}` + resolvedEdgeLink}`;

    try {
        const response = await httpRequest({
            method: 'DELETE',
            url
        });

        const resolvedStatus = Number(response?.status);
        return { data: true, status: Number.isFinite(resolvedStatus) ? resolvedStatus : 204 };

    } catch (error) {
        return {
            status: Number(error?.status) || 500,
            message: error instanceof Error ? error.message : String(error || ''),
            data: error?.data ?? null
        };
    }
}

/**
 * STANDARD WHERE USED
 *
 * Equivalent of GET /where-used
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.wsId
 * @param {number=} params.dmsId
 * @param {string=} params.link
 * @param {number|string=} params.depth
 *
 * @returns {Object}
 * @returns {Object} returns.data
 * @returns {number=} returns.status
 */
export async function getWhereUsed({
                                       tenant,
                                       wsId,
                                       dmsId,
                                       link,
                                       depth
                                   }) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    let resolvedLink = (typeof link !== 'undefined') ? link : `/api/v3/workspaces/${wsId}/items/${dmsId}`;

    const resolvedDepth = (typeof depth !== 'undefined') ? depth : 10;
    const url = `${resolvedLink.startsWith('http') ? resolvedLink : `${APS_BASE(tenant)}` + resolvedLink}` + `/where-used?depth=${resolvedDepth}`;

    try {
        const response = await httpRequest({
            method: 'GET',
            url
        });

        let result = {
            edges: [],
            nodes: [],
            totalCount: 0
        };

        if (response.data !== '') {
            result = response.data;
        }

        return {
            data: result,
            status: response.status
        };

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * WHERE USED PARENTS ONLY
 *
 * Equivalent of GET /parents
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number} params.wsId
 * @param {number} params.dmsId
 *
 * @returns {Object}
 * @returns {Array<Object>} returns.data
 * @returns {number=} returns.status
 */
export async function getWhereUsedParents({
    tenant,
    wsId,
    dmsId
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    const url = `${APS_BASE(tenant)}/api/v3/workspaces/${wsId}/items/${dmsId}` + `/where-used?limit=100&offset=0`;

    try {
        const response = await httpRequest({
            method: 'GET',
            url
        });

        let result = [];
        if (response.data !== '') {
            result = response.data.edges;
        }

        return {
            data: result,
            status: response.status
        };

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * RELATED ITEMS CHANGED
 *
 * Equivalent of GET /related-items
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.wsId
 * @param {number=} params.dmsId
 * @param {string=} params.link
 * @param {number|string=} params.limit
 * @param {number|string=} params.relatedWSID
 *
 * @returns {Object}
 * @returns {Array<Object>} returns.data
 * @returns {number=} returns.status
 */
export async function getRelatedItems({
    tenant,
    wsId,
    dmsId,
    link,
    limit,
    relatedWSID
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    let resolvedLink = (typeof link !== 'undefined') ? link : `/api/v3/workspaces/${wsId}/items/${dmsId}`;

    const resolvedLimit = (typeof limit === 'undefined') ? 100 : limit;
    const url =
        `${resolvedLink.startsWith('http') ? resolvedLink : `${APS_BASE(tenant)}` + resolvedLink}` +
        `/related-items` +
        `?includeChildren=all` +
        `&includeItems=workingVersionHasChanged` +
        `&includeParents=none` +
        `&limit=${resolvedLimit}` +
        `&offset=0` +
        `&relatedWorkspaceId=${relatedWSID}` +
        `&revisionBias=working`;

    try {
        const response = await httpRequest({
            method: 'GET',
            url
        });

        let result = [];
        if (response.data !== '') {
            result = response.data.items;
        }

        return {
            data: result,
            status: response.status
        };

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * PROJECT TAB ENTRIES
 *
 * Equivalent of GET /project
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.wsId
 * @param {number=} params.dmsId
 * @param {string=} params.link
 *
 * @returns {Object}
 */
export async function getProject({
     tenant,
     wsId,
     dmsId,
     link
 }) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    let url = (typeof link !== 'undefined') ? link : `/api/v3/workspaces/${wsId}/items/${dmsId}`;
    url = `${url.startsWith('http') ? url : `${APS_BASE(tenant)}` + url}/views/16`;

    try {
        const response = await httpRequest({
            method: 'GET',
            url
        });

        if (response.data === '') {
            response.data = { projectItems: [] };
        }

        return response;

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * ADD PROJECT TAB ENTRIES
 *
 * Equivalent of POST /add-project-item
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {string} params.link
 * @param {string} params.item
 * @param {string=} params.title
 * @param {string=} params.startDate
 * @param {string=} params.endDate
 * @param {string|number=} params.progress
 * @param {string=} params.predecessors
 *
 * @returns {Object}
 */
export async function addProjectItem({
     tenant,
     link,
     item,
     title,
     startDate,
     endDate,
     progress,
     predecessors
 }) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    const url = `${APS_BASE(tenant)}${link}/views/16`;

    let predecessorList = [];
    let now = new Date();
    let date = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDay();

    if (typeof predecessors !== 'undefined') {
        predecessorList = predecessors.split(',');
    }

    let params = {
        title: title || '',
        startDate: startDate || date,
        endDate: endDate || date,
        progress: progress || 0,
        predecessors: predecessorList
    };

    let headers = {
        'content-location': link + '/views/16/linkable-items/' + item.split('/').pop()
    };

    try {
        const response = await httpRequest({
            method: 'POST',
            url,
            body: params,
            headers
        });

        return response;

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * REMOVE PROJECT TAB ENTRIES
 *
 * Equivalent of POST /remove-project-item
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {string} params.link
 *
 * @returns {Object}
 */
export async function removeProjectItem({
    tenant,
    link
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    const url = `${APS_BASE(tenant)}${link}`;

    try {
        const response = await httpRequest({
            method: 'DELETE',
            url
        });

        return response;

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * CHANGE LOG
 *
 * Equivalent of GET /logs
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.wsId
 * @param {number=} params.dmsId
 * @param {string=} params.link
 *
 * @returns {Object}
 * @returns {Array<Object>} returns.data
 * @returns {number=} returns.status
 */
export async function getChangeLogs({
    tenant,
    wsId,
    dmsId,
    link
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    let resolvedLink = (typeof link !== 'undefined') ? link : `/api/v3/workspaces/${wsId}/items/${dmsId}`;

    const url = `${resolvedLink.startsWith('http') ? resolvedLink : `${APS_BASE(tenant)}` + resolvedLink}` + `/logs?desc=timeStamp&limit=500&offset=0`;

    try {
        const response = await httpRequest({
            method: 'GET',
            url
        });

        let result = [];
        if (response.data !== '') {
            result = response.data.items;
        }

        return {
            data: result,
            status: response.status
        };

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * ITEM VERSIONS
 *
 * Equivalent of GET /versions
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.wsId
 * @param {number=} params.dmsId
 * @param {string=} params.link
 *
 * @returns {Object}
 */
export async function getItemVersions({
    tenant,
    wsId,
    dmsId,
    link
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    const resolvedLink = (typeof link === 'undefined') ? `/api/v3/workspaces/${wsId}/items/${dmsId}` : link;
    const url = `${APS_BASE(tenant)}${resolvedLink}/versions`;

    try {
        const response = await httpRequest({
            method: 'GET',
            url
        });

        return response;

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * GET AVAILABLE WORKFLOW TRANSITIONS
 *
 * Equivalent of GET /transitions
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.wsId
 * @param {number=} params.dmsId
 * @param {string=} params.link
 *
 * @returns {Object}
 */
export async function getWorkflowTransitions({
     tenant,
     wsId,
     dmsId,
     link
 }) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    let resolvedLink = (typeof link !== 'undefined') ? link : `/api/v3/workspaces/${wsId}/items/${dmsId}`;

    const url = `${resolvedLink.startsWith('http') ? resolvedLink : `${APS_BASE(tenant)}` + resolvedLink}` + `/workflows/1/transitions`;

    try {
        const response = await httpRequest({
            method: 'GET',
            url
        });

        return response;

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * PERFORM WORKFLOW TRANSITION
 *
 * Equivalent of GET /transition
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.wsId
 * @param {number=} params.dmsId
 * @param {string=} params.link
 * @param {string} params.transition
 * @param {string=} params.comment
 *
 * @returns {Object}
 */
export async function performWorkflowTransition({
    tenant,
    wsId,
    dmsId,
    link,
    transition,
    comment
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    let resolvedLink = (typeof link !== 'undefined') ? link : `/api/v3/workspaces/${wsId}/items/${dmsId}`;

    const url = `${resolvedLink.startsWith('http') ? resolvedLink : `${APS_BASE(tenant)}` + resolvedLink}` + `/workflows/1/transitions`;
    const headers = {
        'content-location': transition
    };

    try {
        const response = await httpRequest({
            method: 'POST',
            url,
            body: {
                comment: comment
            },
            headers
        });

        return response;

    } catch (error) {
        if (error?.statusCode === 303) {
            return error.response;
        }
        return error?.response ?? error;
    }
}

/**
 * GET WORKFLOW HISTORY
 *
 * Equivalent of GET /workflow-history
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.wsId
 * @param {number=} params.dmsId
 * @param {string=} params.link
 *
 * @returns {Object}
 */
export async function getWorkflowHistory({
     tenant,
     wsId,
     dmsId,
     link
 }) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    let resolvedLink = (typeof link !== 'undefined') ? link : `/api/v3/workspaces/${wsId}/items/${dmsId}`;

    const url = `${resolvedLink.startsWith('http') ? resolvedLink : `${APS_BASE(tenant)}` + resolvedLink}` + `/workflows/1/history`;

    try {
        const response = await httpRequest({
            method: 'GET',
            url
        });

        return response;

    } catch (error) {
        if (error?.statusCode === 303) {
            return error.response;
        }
        return error?.response ?? error;
    }
}

/**
 * PERFORM LIFECYCLE TRANSITION
 *
 * Equivalent of GET /lifecycle-transition
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.wsId
 * @param {number=} params.dmsId
 * @param {string=} params.link
 * @param {string} params.transition
 * @param {string} params.revision
 *
 * @returns {Object}
 */
export async function performLifecycleTransition({
     tenant,
     wsId,
     dmsId,
     link,
     transition,
     revision
 }) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    const resolvedWorkspaceId = (typeof wsId !== 'undefined') ? wsId : link.split('/')[4];
    const resolvedDmsId = (typeof dmsId !== 'undefined') ? dmsId : link.split('/')[6];
    const transitionId = transition.split('/').pop();
    const url = `${APS_BASE(tenant)}/api/rest/v1/workspaces/${resolvedWorkspaceId}` + `/items/${resolvedDmsId}/lifecycles/transitions/${transitionId}`;
    const headers = {
        'Content-Type': 'application/xml'
    };

    const body = `<dmsVersionItem>` + `<release>${revision}</release>` + `</dmsVersionItem>`;

    try {
        const response = await httpRequest({
            method: 'PUT',
            url,
            body,
            headers
        });

        return response;

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * BOOKMARKS
 *
 * Equivalent of GET /bookmarks
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {string|boolean=} params.useCache
 *
 * @returns {Object}
 */
export async function getBookmarks({
   tenant,
   useCache
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    const url = `${APS_BASE(tenant)}/api/v3/users/@me/bookmarks`;

    try {
        const response = await httpRequest({
            method: 'GET',
            url
        });

        if (response.data === '') {
            response.data = { bookmarks: [] };
        }

        return response;

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * ADD BOOKMARK
 *
 * Equivalent of GET /add-bookmark
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number|string} params.dmsId
 * @param {string=} params.comment
 *
 * @returns {Object}
 */
export async function addBookmark({
    tenant,
    dmsId,
    comment
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    if (typeof dmsId === 'undefined') {
        throw new Error('dmsId is required');
    }

    const url = `${APS_BASE(tenant)}/api/v3/users/@me/bookmarks`;

    const params = {
        dmsId: dmsId,
        comment: (typeof comment === 'undefined') ? ' ' : comment
    };

    try {
        const response = await httpRequest({
            method: 'POST',
            url,
            body: params
        });

        return response;

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * REMOVE BOOKMARK
 *
 * Equivalent of GET /remove-bookmark
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number|string} params.dmsId
 *
 * @returns {Object}
 */
export async function removeBookmark({
     tenant,
     dmsId
 }) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    if (typeof dmsId === 'undefined') {
        throw new Error('dmsId is required');
    }

    const url = `${APS_BASE(tenant)}/api/v3/users/@me/bookmarks/${dmsId}`;

    try {
        const response = await httpRequest({
            method: 'DELETE',
            url
        });

        return response;

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * RECENT ITEMS
 *
 * Equivalent of GET /recent
 *
 * @param {Object} params
 * @param {string} params.tenant
 *
 * @returns {Object}
 */
export async function getRecentItems({
     tenant
 }) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    const url = `${APS_BASE(tenant)}/api/v3/users/@me/recently-viewed`;

    try {
        const response = await httpRequest({
            method: 'GET',
            url
        });

        return response;

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * WORKSPACE ITEMS
 *
 * Equivalent of GET /items
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number} params.wsId
 * @param {number|string=} params.offset
 * @param {number|string=} params.limit
 * @param {string|boolean=} params.bulk
 * @param {string|boolean=} params.useCache
 *
 * @returns {Object}
 */
export async function getWorkspaceItems({
    tenant,
    wsId,
    offset,
    limit,
    bulk,
    useCache
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    if (typeof wsId === 'undefined') {
        throw new Error('wsId is required');
    }

    const resolvedOffset = (typeof offset === 'undefined') ? 0 : offset;
    const resolvedLimit = (typeof limit === 'undefined') ? 100 : limit;
    const isBulk = (typeof bulk !== 'undefined') ? (bulk === true || bulk === 'true') : false;
    let url = `${APS_BASE(tenant)}/api/v3/workspaces/${wsId}/items` + `?offset=${resolvedOffset}&limit=${resolvedLimit}`;

    const headers = {};

    if (isBulk) {
        headers['Accept'] = 'application/vnd.autodesk.plm.items.bulk+json';
    }

    try {
        const response = await httpRequest({
            method: 'GET',
            url,
            headers
        });

        if (response.data === '') {
            response.data = { items: [] };
        }

        return response;

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * SEARCH
 *
 * Equivalent of POST /search
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.wsId
 * @param {string=} params.link
 * @param {boolean=} params.latest
 * @param {Array<string>=} params.sort
 * @param {Array<string>=} params.fields
 * @param {Array<string>=} params.grid
 * @param {Array<Object>=} params.filter
 * @param {number|string=} params.pageNo
 * @param {number|string=} params.pageSize
 * @param {string=} params.logicClause
 *
 * @returns {Object}
 * @returns {Object} returns.data
 * @returns {number=} returns.status
 */
export async function search({
     tenant,
     wsId,
     link,
     latest,
     sort,
     fields,
     grid,
     filter,
     pageNo,
     pageSize,
     logicClause
 }) {

    function setBodyFields(body, fields, grid) {

        for (let field of fields) {
            body.fields.push({
                fieldID: field,
                fieldTypeID: getFieldType(field)
            });
        }

        if (fields.length === 0) {
            body.fields.push({
                fieldID: 'DESCRIPTOR',
                fieldTypeID: 15
            });
        }

        for (let column of grid) {
            body.fields.push({
                fieldID: column,
                fieldTypeID: 2
            });
        }

    }

    function getFieldType(fieldID) {

        var fieldType = 0;

        switch (fieldID) {

            case 'OWNER_USERID':
            case 'CREATED_ON':
            case 'CREATED_BY_USERID':
            case 'LAST_MODIFIED_ON':
            case 'LAST_MODIFIED_BY':
                fieldType = 3;
                break;

            case 'LATEST_RELEASE':
            case 'WORKING':
            case 'LC_RELEASE_LETTER':
            case 'LIFECYCLE_NAME':
                fieldType = 10;
                break;

            case 'WF_CURRENT_STATE':
            case 'WF_LAST_TRANS':
            case 'WF_LAST_COMMENTS':
                fieldType = 1;
                break;

            case 'DESCRIPTOR':
                fieldType = 15;
                break;

        }

        return fieldType;

    }

    function setBodySort(body, sorts) {

        if (sorts.length === 0) {

            body.sort.push({
                fieldID: 'DESCRIPTOR',
                fieldTypeID: 15,
                sortAscending: true
            });

        } else {

            for (var i = 0; i < sorts.length; i++) {

                var sort = {
                    fieldID: sorts[i],
                    fieldTypeID: 0,
                    sortDescending: false
                };

                if (sort.fieldID === 'DESCRIPTOR') sort.fieldTypeID = 15;

                body.sort.push(sort);

            }
        }

    }

    function setBodyFilter(body, filters) {

        for (let filter of filters) {

            if (typeof filter.value === 'undefined') {
                console.log();
                console.log('  !! ERROR !! Ignoring filter for ' + filter.field + ' as value is undefined');
                console.log();
            } else {
                body.filter.push({
                    fieldID: filter.field,
                    fieldTypeID: Number(filter.type),
                    filterType: { filterID: filter.comparator },
                    filterValue: filter.value
                });
            }

        }

    }

    if (!tenant) {
        throw new Error('tenant is required');
    }

    let resolvedFields = (typeof fields === 'undefined') ? [] : fields;
    let resolvedGrid   = (typeof grid   === 'undefined') ? [] : grid;
    let resolvedFilter = (typeof filter === 'undefined') ? [] : filter;
    let resolvedSort   = (typeof sort   === 'undefined') ? [] : sort;
    let resolvedWsId = (typeof wsId === 'undefined') ? link.split('/')[4] : wsId;

    const url = `${APS_BASE(tenant)}/api/rest/v1/workspaces/${resolvedWsId}/items/search`;

    if (!resolvedFields.includes('DESCRIPTOR')) resolvedFields.push('DESCRIPTOR');

    let requestBody = {
        pageNo: pageNo || 1,
        pageSize: Number(pageSize) || 100,
        logicClause: logicClause || 'AND',
        fields: [],
        filter: [],
        sort: []
    };

    setBodyFields(requestBody, resolvedFields, resolvedGrid);
    setBodySort(requestBody, resolvedSort);
    setBodyFilter(requestBody, resolvedFilter);

    if (typeof latest !== 'undefined') {
        if (latest) {
            requestBody.filter.push({
                fieldID: 'LC_RELEASE_LETTER',
                fieldTypeID: '10',
                filterType: { filterID: 20 },
                filterValue: 'true'
            });
        }
    }

    try {
        const response = await httpRequest({
            method: 'POST',
            url,
            body: requestBody
        });

        let result = { row: [] };

        if (response.data !== undefined) {
            if (response.data !== '') {
                result = response.data;
            }
        }

        return { data: result, status: response.status };

    } catch (error) {
        if (error?.response?.data !== undefined) {
            error.response.data = { row: [] };
        }
        return error?.response ?? error;
    }
}

/**
 * SEARCH DESCRIPTOR
 *
 * Equivalent of POST /search-descriptor
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number|string=} params.wsId
 * @param {Array<number|string>=} params.workspaces
 * @param {string} params.query
 * @param {number|string=} params.limit
 * @param {number|string=} params.offset
 * @param {string|boolean=} params.bulk
 * @param {string|number=} params.page
 * @param {string|number=} params.revision
 * @param {string|boolean=} params.wildcard
 *
 * @returns {Object}
 */
export async function searchDescriptor({
    tenant,
    wsId,
    workspaces,
    query,
    limit,
    offset,
    bulk,
    page,
    revision,
    wildcard
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    let resolvedLimit    = (typeof limit    === 'undefined') ? 100     : limit;
    let resolvedOffset   = (typeof offset   === 'undefined') ? 0       : offset;
    let resolvedBulk     = (typeof bulk     === 'undefined') ? 'false' : bulk;
    let resolvedPage     = (typeof page     === 'undefined') ? '1'     : page;
    let resolvedRevision = (typeof revision === 'undefined') ? '1'     : revision;
    let resolvedWildcard = (typeof wildcard === 'undefined') ? true    : (String(wildcard).toLowerCase() === 'true');

    let url =
        `${APS_BASE(tenant)}/api/v3/search-results?limit=${resolvedLimit}` +
        `&offset=${resolvedOffset}` +
        `&page=${resolvedPage}` +
        `&query=`;

    let values = query.split(' ');

    if (values.length > 1) {
        let builtQuery = '';
        for (let value of values) {
            if (value !== '-') {
                if (builtQuery !== '') builtQuery += '+OR+';
                if (!isNaN(value)) builtQuery += 'itemDescriptor%3D*' + value + '*';
                else builtQuery += 'itemDescriptor%3D' + value;
            }
        }
        url += '(' + builtQuery + ')';
    } else if (!resolvedWildcard) {
        url += 'itemDescriptor%3D%22' + query + '%22';
    } else {
        url += 'itemDescriptor%3D*' + query + '*';
    }

    if (typeof wsId !== 'undefined') {
        url += '+AND+(workspaceId%3D' + wsId + ')';
    }

    if (typeof workspaces !== 'undefined') {
        url += '+AND+(';
        let isFirst = true;
        for (let workspace of workspaces) {
            if (!isFirst) url += '+OR+';
            url += 'workspaceId%3D' + workspace;
            isFirst = false;
        }
        url += ')';
    }

    url += '&revision=' + resolvedRevision;

    const headers = {};

    if (resolvedBulk !== 'false') {
        headers.Accept = 'application/vnd.autodesk.plm.items.bulk+json';
    }

    try {
        const response = await httpRequest({
            method: 'GET',
            url,
            headers
        });

        if (response.data === '') {
            response.data = { items: [] };
        }

        return response;

    } catch (error) {
        return error?.response ?? error;
    }
}


/**
 * SEARCH BULK
 *
 * Equivalent of GET /search-bulk
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number|string=} params.wsId
 * @param {string} params.query
 * @param {number|string=} params.limit
 * @param {number|string=} params.offset
 * @param {string|boolean=} params.bulk
 * @param {string|number=} params.page
 * @param {string|number=} params.revision
 * @param {string|boolean=} params.useCache
 *
 * @returns {Object}
 */
export async function searchBulk({
     tenant,
     wsId,
     query,
     limit,
     offset,
     bulk,
     page,
     revision,
     sort,
     useCache
 }) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    let resolvedLimit    = (typeof limit    === 'undefined') ? 100  : limit;
    let resolvedOffset   = (typeof offset   === 'undefined') ? 0    : offset;
    let resolvedBulk     = (typeof bulk     === 'undefined') ? true : bulk;
    let resolvedPage     = (typeof page     === 'undefined') ? ''   : page;
    let resolvedRevision = (typeof revision === 'undefined') ? '1'  : revision;
    let resolvedSort     = (typeof sort     === 'undefined') ? ''   : String(sort).trim();

    let url =
        `${APS_BASE(tenant)}/api/v3/search-results?limit=${resolvedLimit}` +
        `&offset=${resolvedOffset}` +
        `&query=${query}` +
        `&revision=${resolvedRevision}`;

    if (resolvedPage !== '') {
        url += `&page=${resolvedPage}`;
    }

    if (resolvedSort) {
        url += `&sort=${encodeURIComponent(resolvedSort)}`;
    }

    if (typeof wsId !== 'undefined') {
        url += '+AND+(workspaceId%3D' + wsId + ')';
    }

    const headers = {};

    if (resolvedBulk) {
        headers.Accept = 'application/vnd.autodesk.plm.items.bulk+json';
    }

    try {
        const response = await httpRequest({
            method: 'GET',
            url,
            headers
        });

        if (response.data === '') {
            response.data = { items: [] };
        }

        return response;

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * SEARCH IN CLASS
 *
 * Equivalent of GET /search-class
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {string} params.className
 * @param {string=} params.query
 * @param {string=} params.sort
 * @param {number|string=} params.limit
 * @param {number|string=} params.offset
 * @param {string|number=} params.page
 * @param {string|boolean=} params.bulk
 * @param {string|number=} params.revision
 * @param {string|boolean=} params.useCache
 *
 * @returns {Object}
 */
export async function searchClass({
    tenant,
    className,
    query,
    sort,
    limit,
    offset,
    page,
    bulk,
    revision,
    useCache
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    let resolvedQuery    = (typeof query    === 'undefined') ? ''   : query;
    let resolvedSort     = (typeof sort     === 'undefined') ? ''   : sort;
    let resolvedLimit    = (typeof limit    === 'undefined') ? 10   : limit;
    let resolvedOffset   = (typeof offset   === 'undefined') ? 0    : offset;
    let resolvedPage     = (typeof page     === 'undefined') ? '1'  : page;
    let resolvedBulk     = (typeof bulk     === 'undefined') ? true : bulk;
    let resolvedRevision = (typeof revision === 'undefined') ? '1'  : revision;

    if (resolvedQuery === '') {
        resolvedQuery = '(CLASS:CLASS_PATH="' + className + '")';
    }

    let url =
        `${APS_BASE(tenant)}/api/v3/search-results?limit=${resolvedLimit}` +
        `&offset=${resolvedOffset}` +
        `&page=${resolvedPage}` +
        `&revision=${resolvedRevision}` +
        `&query=${resolvedQuery}`;

    if (resolvedSort !== '') {
        url += `&sort=${resolvedSort}`;
    }

    const headers = {};

    if (resolvedBulk) {
        headers.Accept = 'application/vnd.autodesk.plm.items.bulk+json';
    }

    try {
        const response = await httpRequest({
            method: 'GET',
            url,
            headers
        });

        if (response.data === '') {
            response.data = { items: [] };
        }

        return response;

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * GET CLASSIFICATION CLASSES
 *
 * Equivalent of GET /classes
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number|string=} params.size
 * @param {number|string=} params.page
 * @param {string|boolean=} params.useCache
 *
 * @returns {Object}
 */
export async function getClasses({
     tenant,
     size,
     page,
     useCache
 }) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    let resolvedSize = (typeof size === 'undefined') ? 500 : size;
    let resolvedPage = (typeof page === 'undefined') ? 1 : page;

    const url = `${APS_BASE(tenant)}/api/v2/classifications?size=${resolvedSize}&page=${resolvedPage}`;

    try {
        const response = await httpRequest({
            method: 'GET',
            url
        });

        return response;

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * GET CLASSIFICATION TREE
 *
 * Equivalent of GET /classes-tree
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {string|boolean=} params.useCache
 *
 * @returns {Object}
 */
export async function getClassesTree({
     tenant,
     useCache
 }) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    const url = `${APS_BASE(tenant)}/api/v2/classifications/1/graphs/adjacency-set`;

    try {
        const response = await httpRequest({
            method: 'GET',
            url
        });

        return response;

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
* GET CLASSIFICATION PROPERTIES
*
* Equivalent of GET /class-properties
*
* @param {Object} params
* @param {string} params.tenant
* @param {string|number=} params.classId
* @param {string=} params.link
* @param {number|string=} params.size
* @param {number|string=} params.page
* @param {string|boolean=} params.useCache
*
* @returns {Object}
* @returns {Array<Object>} returns.data
* @returns {number=} returns.status
*/
export async function getClassProperties({
    tenant,
    classId,
    link,
    size,
    page,
    useCache
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    const resolvedClassId = (typeof classId === 'undefined') ? link.split('/').pop() : classId;
    const resolvedSize = (typeof size === 'undefined') ? 500 : size;
    const resolvedPage = (typeof page === 'undefined') ? 1 : page;
    const url =
        `${APS_BASE(tenant)}/api/v2/property-instances?` +
        `classification=${resolvedClassId}` +
        `&inherited=true` +
        `&page=${resolvedPage}` +
        `&size=${resolvedSize}`;

    try {
        const propertyInstancesResponse = await httpRequest({
            method: 'GET',
            url
        });

        const requests = [];
        const results = { data: [], status: 200 };

        const propertyInstances =
            propertyInstancesResponse?.data?.propertyInstances || [];

        for (let propertyInstance of propertyInstances) {
            requests.push(
                httpRequest({
                    method: 'GET',
                    url: `${APS_BASE(tenant)}/api/v2/property-instances/${propertyInstance.id}/properties`
                })
            );
        }

        const propertyDetailsResponses = await Promise.all(requests);

        let index = 0;
        const requestsPicklists = [];

        for (let propertyDetailsResponse of propertyDetailsResponses) {
            const propertyDetails = propertyDetailsResponse?.data?.properties?.[0];
            const propertyInstance = propertyInstances[index++];

            results.data.push({
                type: propertyDetails.type,
                name: propertyDetails.name,
                displayName: propertyDetails.displayName,
                rank: propertyDetails.rank,
                required: propertyDetails.required,
                readOnly: propertyDetails.readOnly,
                defaultValue: propertyDetails.defaultValue,
                picklist: [],
                inherited: propertyInstance.inherited
            });

            if (propertyDetails.type === 'picklist') {
                requestsPicklists.push(
                    httpRequest({
                        method: 'GET',
                        url:
                            `${APS_BASE(tenant)}/api/v3/lookups/CUSTOM_LOOKUP_0CWS_` +
                            `${propertyDetails.name}_${resolvedClassId}` +
                            `?asc=title&filter=&limit=100&offset=0`
                    })
                );
            }
        }

        sortArray(results.data, 'displayName');

        const picklistResponses = await Promise.all(requestsPicklists);

        for (let picklistResponse of picklistResponses) {
            const picklistData = picklistResponse?.data;

            for (let propertyEntry of results.data) {
                const name = picklistData.urn.split('CUSTOM_LOOKUP_0CWS_')[1];
                if ((propertyEntry.name + '_' + resolvedClassId) === name) {
                    propertyEntry.picklist = picklistData.items;
                }
            }
        }

        return results;

    } catch (error) {
        return error?.response ?? error;
    }
}


/**
 * LIST OF TABLEAUS
 *
 * Equivalent of GET /tableaus
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.wsId
 * @param {string=} params.link
 * @param {string=} params.user
 * @param {string|boolean=} params.useCache
 *
 * @returns {Object}
 * @returns {Array<Object>} returns.data
 * @returns {number=} returns.status
 */
export async function getTableaus({
    tenant,
    wsId,
    link,
    user,
    useCache
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    let resolvedWorkspaceId = (typeof wsId === 'undefined') ? link.split('/')[4] : wsId;

    const url = `${APS_BASE(tenant)}/api/v3/workspaces/${resolvedWorkspaceId}/tableaus`;
    const headers = {};

    if (typeof user !== 'undefined') {
        headers['X-user-id'] = user;
    }

    try {
        const response = await httpRequest({
            method: 'GET',
            url,
            headers
        });

        let result = [];
        if (response.data !== '') {
            result = response.data.tableaus;
        }

        return { data: result, status: response.status };

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * CREATE INITIAL TABLEAU
 *
 * Equivalent of GET /tableau-init
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number} params.wsId
 *
 * @returns {Object}
 */
export async function initTableau({
    tenant,
    wsId
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    if (typeof wsId === 'undefined') {
        throw new Error('wsId is required');
    }

    const url = `${APS_BASE(tenant)}/api/v3/workspaces/${wsId}/tableaus`;

    try {
        const response = await httpRequest({
            method: 'POST',
            url,
            body: {}
        });

        return response;

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * CREATE WORKSPACE VIEW
 *
 * Equivalent of POST /tableau-add
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.wsId
 * @param {string=} params.link
 * @param {string=} params.name
 * @param {Array<string|Object>=} params.columns
 * @param {Array<Object>=} params.filters
 * @param {boolean|string=} params.default
 * @param {boolean|string=} params.showDeleted
 *
 * @returns {Object}
 */
export async function addTableau({
     tenant,
     wsId,
     link,
     name,
     columns,
     filters,
     default: defaultValue,
     showDeleted
 }) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    const resolvedWorkspaceId = (typeof wsId === 'undefined') ? link.split('/')[4] : wsId;
    const url = `https://${tenant}.autodeskplm360.net/api/v3/workspaces/${resolvedWorkspaceId}/tableaus`;

    let title = (typeof name === 'undefined') ? 'New View' : name;
    let isDefault = (typeof defaultValue === 'undefined') ? false : defaultValue;
    let showOnlyDeletedRecords = (typeof showDeleted === 'undefined') ? false : showDeleted;

    if (title.length > 30) {
        return { status: 500, message: 'Tableau name must not exceed 30 characters' };
    }

    const requestBody = {
        name: title,
        createdDate: new Date(),
        isDefault: isDefault,
        showOnlyDeletedRecords: showOnlyDeletedRecords,
        columns: []
    };

    const headers = {};

    try {
        requestBody.columns = await genTableauColumms({
            tenant,
            wsId: resolvedWorkspaceId,
            columns,
            filters,
            headers
        });

        headers['Content-Type'] = 'application/vnd.autodesk.plm.meta+json';

        const response = await httpRequest({
            method: 'POST',
            url,
            body: requestBody,
            headers
        });

        response.data = response.headers.location.split('.autodeskplm360.net')[1];
        return response;

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * CREATE WORKSPACE VIEW
 *
 * Equivalent of POST /tableau-clone
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number} params.wsId
 * @param {string} params.name
 * @param {Array<Object>|Array<string>} params.columns
 * @param {boolean|string=} params.default
 * @param {boolean|string=} params.showDeleted
 *
 * @returns {Object}
 */
export async function cloneTableau({
    tenant,
    wsId,
    name,
    columns,
    default: isDefault,
    showDeleted
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    if (typeof wsId === 'undefined') {
        throw new Error('wsId is required');
    }

    const resolvedIsDefault = (typeof isDefault === 'undefined') ? false : isDefault;
    const resolvedShowDeleted = (typeof showDeleted === 'undefined') ? false : showDeleted;
    const url = `${APS_BASE(tenant)}/api/v3/workspaces/${wsId}/tableaus`;

    const headers = {};

    headers['Content-Type'] = 'application/vnd.autodesk.plm.meta+json';

    const requestBody = {
        name: name,
        createdDate: new Date(),
        isDefault: resolvedIsDefault,
        columns: columns,
        showOnlyDeletedRecords: resolvedShowDeleted
    };

    try {
        const response = await httpRequest({
            method: 'POST',
            url,
            body: requestBody,
            headers
        });

        return response;

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * DELETE WORKSPACE VIEW
 *
 * Equivalent of POST /tableau-delete
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {string} params.link
 *
 * @returns {Object}
 */
export async function deleteTableau({
    tenant,
    link
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    if (!link) {
        throw new Error('link is required');
    }

    const url = `${APS_BASE(tenant)}${link}`;
    const headers = {};

    try {
        const response = await httpRequest({
            method: 'DELETE',
            url,
            headers
        });

        return response;

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * TABLEAU COLUMNS
 *
 * Equivalent of GET /tableau-columns
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {string} params.link
 *
 * @returns {Object}
 */
export async function getTableauColumns({
    tenant,
    link
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    if (!link) {
        throw new Error('link is required');
    }

    const url = `${APS_BASE(tenant)}${link}`;

    const headers = {
        Accept: 'application/vnd.autodesk.plm.meta+json'
    };

    try {
        const response = await httpRequest({
            method: 'GET',
            url,
            headers
        });

        let result = [];
        if (response?.data !== '') {
            result = response.data.columns;
        }

        return {
            data: result,
            status: response.status
        };

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * TABLEAU DATA
 *
 * Equivalent of GET /tableau-data
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {string} params.link
 * @param {string|number=} params.page
 * @param {string|number=} params.size
 *
 * @returns {Object}
 */
export async function getTableauData({
     tenant,
     link,
     page,
     size
 }) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    if (!link) {
        throw new Error('link is required');
    }

    let resolvedPage = (typeof page === 'undefined') ? '1' : page;
    let resolvedSize = (typeof size === 'undefined') ? '50' : size;

    const url = `${APS_BASE(tenant)}${link}?page=${resolvedPage}&size=${resolvedSize}`;

    try {
        const response = await httpRequest({
            method: 'GET',
            url
        });

        if (response.data !== '') {
            if (typeof response.data.items === 'undefined') {
                response.data.items = [];
            }
        } else {
            response.data = { items: [] };
        }

        return response;

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * ALL REPORTS
 *
 * Equivalent of GET /reports
 *
 * @param {Object} params
 * @param {string} params.tenant
 *
 * @returns {Object}
 */
export async function getReports({
     tenant
 }) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    const url = `${APS_BASE(tenant)}/api/rest/v1/reports`;

    try {
        const response = await httpRequest({
            method: 'GET',
            url
        });

        return response;

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * REPORT
 *
 * Equivalent of GET /report
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {string|number} params.reportId
 *
 * @returns {Object}
 */
export async function getReport({
    tenant,
    reportId
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    if (typeof reportId === 'undefined') {
        throw new Error('reportId is required');
    }

    const url = `${APS_BASE(tenant)}/api/rest/v1/reports/${reportId}`;

    try {
        const response = await httpRequest({
            method: 'GET',
            url
        });

        return response;

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * GET AVAILABLE CHARTS
 *
 * Equivalent of GET /charts-available
 *
 * @param {Object} params
 * @param {string} params.tenant
 *
 * @returns {Object}
 */
export async function getAvailableCharts({
     tenant
 }) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    const url = `${APS_BASE(tenant)}/api/v3/users/@me/available-charts`;

    try {
        const response = await httpRequest({
            method: 'GET',
            url
        });

        return response;

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * SET DASHBOARD CHART
 *
 * Equivalent of GET /chart-set
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number|string} params.index
 * @param {string=} params.link
 * @param {string=} params.userId
 *
 * @returns {Object}
 */
export async function setDashboardChart({
    tenant,
    index,
    link,
    userId,
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    if (typeof index === 'undefined') {
        throw new Error('index is required');
    }

    if (!userId) {
        throw new Error('userId is required');
    }

    const url = `${APS_BASE(tenant)}/api/v3/users/${userId}/dashboard-charts/${index}`;
    const method = (typeof link === 'undefined') ? 'DELETE' : 'PUT';
    const body =
        (typeof link === 'undefined') ? {} : { chart: { link } };
        (typeof link === 'undefined') ? {} : { chart: { link } };

    try {
        const response = await httpRequest({
            method,
            url,
            body,
        });

        return response;

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * GET DASHBOARD CHARTS
 *
 * Equivalent of GET /charts-pinned
 *
 * @param {Object} params
 * @param {string} params.tenant
 *
 * @returns {Object}
 */
export async function getPinnedCharts({
  tenant,
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    const url = `${APS_BASE(tenant)}/api/rest/v1/reports/dashboard`;

    const headers = {};

    try {
        const response = await httpRequest({
            method: 'GET',
            url,
            headers
        });

        if (response.data.dashboardReportList === null) {
            response.data.dashboardReportList = { list: [] };
        }

        return response;

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * GET WORKSPACE DATA
 *
 * Equivalent of GET /workspace
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.wsId
 * @param {string=} params.link
 * @param {string|boolean=} params.useCache
 *
 * @returns {Object}
 */
export async function getWorkspace({
    tenant,
    wsId,
    link,
    useCache
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    const resolvedWorkspaceId = (typeof wsId === 'undefined') ? link.split('/')[4] : wsId;
    const url = `${APS_BASE(tenant)}/api/v3/workspaces/${resolvedWorkspaceId}`;

    try {
        const response = await httpRequest({
            method: 'GET',
            url
        });

        return response;

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * GET WORKSPACES
 *
 * Equivalent of GET /workspaces
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.offset
 * @param {number=} params.limit
 * @param {string|boolean=} params.useCache
 *
 * @returns {Object}
 */
export async function getWorkspaces({
    tenant,
    offset = 0,
    limit = 250,
    useCache
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    const url = `${APS_BASE(tenant)}/api/v3/workspaces?offset=${offset}&limit=${limit}`;

    try {
        const response = await httpRequest({
            method: 'GET',
            url
        });

        return response;

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * GET WORKSPACE COUNTER
 *
 * Equivalent of GET /workspace-counter
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.wsId
 * @param {string=} params.link
 *
 * @returns {Object}
 */
export async function getWorkspaceCounter({
    tenant,
    wsId,
    link
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    const resolvedWorkspaceId = (typeof wsId === 'undefined') ? link.split('/')[4] : wsId;
    const url = `${APS_BASE(tenant)}/api/v3/search-results` + `?limit=1&offset=0&query=workspaceId%3D${resolvedWorkspaceId}`;

    try {
        const response = await httpRequest({
            method: 'GET',
            url
        });

        return response;

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * GET ID OF DEFINED WORKSPACE
 *
 * Equivalent of GET /get-workspace-id
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {string} params.name
 * @param {number=} params.offset
 * @param {number=} params.limit
 *
 * @returns {Object}
 * @returns {number} returns.data  Workspace ID or -1 if not found
 */
export async function getWorkspaceIdByName({
    tenant,
    name,
    offset,
    limit
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }
    if (!name) {
        throw new Error('name is required');
    }

    const resolvedOffset = (typeof offset === 'undefined') ? 0 : offset;
    const resolvedLimit  = (typeof limit  === 'undefined') ? 500 : limit;
    const url = `${APS_BASE(tenant)}/api/v3/workspaces` + `?offset=${resolvedOffset}&limit=${resolvedLimit}`;

    try {
        const response = await httpRequest({
            method: 'GET',
            url
        });

        let result = { data: -1 };

        const workspaces = response?.data?.items || [];

        for (const workspace of workspaces) {
            if (workspace.title === name) {
                result.data = Number(workspace.link.split('/')[4]);
                break;
            }
        }

        return result;

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * GET WORKSPACE SCRIPTS
 *
 * Equivalent of GET /workspace-scripts
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.wsId
 * @param {string=} params.link
 * @param {string|boolean=} params.useCache
 *
 * @returns {Object}
 */
export async function getWorkspaceScripts({
    tenant,
    wsId,
    link,
    useCache
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    const resolvedWorkspaceId = (typeof wsId === 'undefined') ? link.split('/')[4] : wsId;
    const url = `${APS_BASE(tenant)}/api/v3/workspaces/${resolvedWorkspaceId}/scripts`;

    try {
        const response = await httpRequest({
            method: 'GET',
            url
        });

        if (response.data === '') {
            response.data = { scripts: [] };
        }

        return response;

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * GET WORKSPACE RELATIONSHIPS
 *
 * Equivalent of GET /workspace-relationships
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.wsId
 * @param {string=} params.link
 * @param {string=} params.type
 *
 * @returns {Object}
 */
export async function getWorkspaceRelationships({
    tenant,
    wsId,
    link,
    type
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    let resolvedType =
        (typeof type === 'undefined') ? 'relationships' : type;

    let view = '';

    if (resolvedType.toLowerCase().indexOf('rel')  === 0) view =  '10';
    else if (resolvedType.toLowerCase().indexOf('bom')  === 0) view = '200';
    else if (resolvedType.toLowerCase().indexOf('proj') === 0) view =  '16';
    else if (resolvedType.toLowerCase().indexOf('mana') === 0) view = '100';
    else if (resolvedType.toLowerCase().indexOf('aff')  === 0) view = '100';

    const resolvedWorkspaceId = (typeof wsId === 'undefined') ? link.split('/')[4] : wsId;
    const url = `${APS_BASE(tenant)}/api/v3/workspaces/${resolvedWorkspaceId}/views/${view}/related-workspaces`;

    try {
        const response = await httpRequest({
            method: 'GET',
            url
        });

        if (response.data === '') {
            response.data = { workspaces: [] };
        }

        return response;

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * GET WORKSPACE PRINT VIEWS
 *
 * Equivalent of GET /workspace-print-views
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.wsId
 * @param {string=} params.link
 *
 * @returns {Object}
 */
export async function getWorkspacePrintViews({
     tenant,
     wsId,
     link
 }) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    const resolvedWorkspaceId = (typeof wsId === 'undefined') ? link.split('/')[4] : wsId;
    const url = `${APS_BASE(tenant)}/api/v3/workspaces/${resolvedWorkspaceId}/print-views?desc=type&asc=title`;

    try {
        const response = await httpRequest({
            method: 'GET',
            url
        });

        if (response.data === '') {
            response.data = { links: [] };
        }

        return response;

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * GET WORKSPACE WORKFLOW STATES
 *
 * Equivalent of GET /workspace-workflow-states
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.wsId
 * @param {string=} params.link
 *
 * @returns {Object}
 */
export async function getWorkspaceWorkflowStates({
     tenant,
     wsId,
     link
 }) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    const resolvedWorkspaceId = (typeof wsId === 'undefined') ? link.split('/')[4] : wsId;
    const url = `${APS_BASE(tenant)}/api/v3/workspaces/${resolvedWorkspaceId}/workflows/1/states`;

    try {
        const response = await httpRequest({
            method: 'GET',
            url
        });

        if (response.data === '') {
            response.data = { states: [] };
        }

        return response;

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * GET WORKSPACE WORKFLOW TRANSITIONS
 *
 * Equivalent of GET /workspace-workflow-transitions
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.wsId
 * @param {string=} params.link
 * @param {string|boolean=} params.useCache
 *
 * @returns {Object}
 */
export async function getWorkspaceWorkflowTransitions({
    tenant,
    wsId,
    link,
    useCache
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    const resolvedWorkspaceId = (typeof wsId === 'undefined') ? link.split('/')[4] : wsId;
    const url = `${APS_BASE(tenant)}/api/v3/workspaces/${resolvedWorkspaceId}/workflows/1/transitions`;

    try {
        const response = await httpRequest({
            method: 'GET',
            url
        });

        if (response.data === '') {
            response.data = [];
        }

        return response;

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * GET WORKSPACE LIFECYCLE TRANSITIONS
 *
 * Equivalent of GET /workspace-lifecycle-transitions
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.wsId
 * @param {string=} params.link
 *
 * @returns {Object}
 */
export async function getWorkspaceLifecycleTransitions({
    tenant,
    wsId,
    link
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    const resolvedWorkspaceId = (typeof wsId === 'undefined') ? link.split('/')[4] : wsId;
    const url = `${APS_BASE(tenant)}/api/v3/workspaces/${resolvedWorkspaceId}/transitions`;

    try {
        const response = await httpRequest({
            method: 'GET',
            url,
            headers: {
                Accept: 'application/vnd.autodesk.plm.transitions.bulk+json'
            }
        });

        if (response.data === '') {
            response.data = [];
        }

        return response;

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * GET ALL SCRIPTS
 *
 * Equivalent of GET /scripts
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {string|boolean=} params.useCache
 *
 * @returns {Object}
 */
export async function getAllScripts({
    tenant,
    useCache
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    const url = `${APS_BASE(tenant)}/api/v3/scripts`;

    try {
        const response = await httpRequest({
            method: 'GET',
            url
        });

        return response;

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * GET SCRIPT SOURCE
 *
 * Equivalent of GET /script
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {string} params.link
 *
 * @returns {Object}
 */
export async function getScriptSource({
    tenant,
    link
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }
    if (!link) {
        throw new Error('link is required');
    }

    const url = `${APS_BASE(tenant)}${link}`;

    try {
        const response = await httpRequest({
            method: 'GET',
            url
        });

        return response;

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * RUN ON-DEMAND SCRIPT FOR ITEM
 *
 * Equivalent of POST /run-item-script
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {string} params.link          // Item link (/api/v3/workspaces/{wsId}/items/{dmsId})
 * @param {string=} params.script       // Script link
 * @param {string=} params.scriptId     // Script ID (overrides script link if provided)
 * @param {string|boolean=} params.getDetails
 *
 * @returns {Object}
 */
export async function runItemScript({
    tenant,
    link,
    script,
    scriptId,
    getDetails
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }
    if (!link) {
        throw new Error('link is required');
    }
    if (!script && !scriptId) {
        throw new Error('script or scriptId is required');
    }

    const resolvedScriptId = scriptId || String(script).split('/').pop();
    const runUrl = `${APS_BASE(tenant)}${link}/scripts/${resolvedScriptId}`;

    const shouldGetDetails = typeof getDetails === 'undefined' ? false : getDetails === true || getDetails === 'true';

    try {
        const runResponse = await httpRequest({
            method: 'POST',
            url: runUrl,
            body: {}
        });

        if (shouldGetDetails) {
            const detailsResponse = await httpRequest({
                method: 'GET',
                url: `${APS_BASE(tenant)}${link}`
            });

            return detailsResponse;
        }

        return runResponse;

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * GET ROLES (V1)
 *
 * Equivalent of GET /roles
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {string|boolean=} params.useCache
 *
 * @returns {Object}
 */
export async function getRoles({
   tenant,
   useCache
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    const rolesUrl = `${APS_BASE(tenant)}/api/rest/v1/roles`;

    try {
        const response = await httpRequest({
            method: 'GET',
            url: rolesUrl
        });

        return response;

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * GET ALL GROUPS
 *
 * Equivalent of GET /groups
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.limit
 * @param {number=} params.offset
 * @param {string|boolean=} params.bulk
 *
 * @returns {Object}
 */
export async function getGroups({
    tenant,
    limit,
    offset,
    bulk
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    const resolvedLimit  = (typeof limit  === 'undefined') ? 100 : limit;
    const resolvedOffset = (typeof offset === 'undefined') ? 0   : offset;
    const useBulk        = (typeof bulk   === 'undefined') ? true : (bulk === true || bulk === 'true');
    const url = `${APS_BASE(tenant)}/api/v3/groups?offset=${resolvedOffset}&limit=${resolvedLimit}`;

    const headers = {};
    if (useBulk) {
        headers.Accept = 'application/vnd.autodesk.plm.groups.bulk+json';
    }

    try {
        const response = await httpRequest({
            method: 'GET',
            url,
            headers
        });

        return response;

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * GET ALL USERS
 *
 * Equivalent of GET /users
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.limit
 * @param {number=} params.offset
 * @param {string|boolean=} params.bulk
 * @param {string|boolean=} params.activeOnly
 * @param {string|boolean=} params.mappedOnly
 *
 * @returns {Object}
 */
export async function getUsers({
   tenant,
   limit,
   offset,
   bulk,
   activeOnly,
   mappedOnly
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    const resolvedBulk            = (typeof bulk       === 'undefined')  ? true   : (bulk === true || bulk === 'true');
    const resolvedLimit           = (typeof limit      === 'undefined')  ? 1000   : limit;
    const resolvedOffset          = (typeof offset     === 'undefined')  ? 0      : offset;
    const resolvedActiveOnly = (typeof activeOnly === 'undefined') ? 'false' : activeOnly;
    const resolvedMappedOnly = (typeof mappedOnly === 'undefined') ? 'false' : mappedOnly;
    const url =
        `${APS_BASE(tenant)}/api/v3/users?sort=displayName` +
        `&activeOnly=${resolvedActiveOnly}` +
        `&mappedOnly=${resolvedMappedOnly}` +
        `&offset=${resolvedOffset}` +
        `&limit=${resolvedLimit}`;

    const headers = {};
    if (resolvedBulk) {
        headers.Accept = 'application/vnd.autodesk.plm.users.bulk+json';
    }

    try {
        const response = await httpRequest({
            method: 'GET',
            url,
            headers
        });

        return response;

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * ADD NEW USER
 *
 * Equivalent of POST /add-user
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {string} params.mail
 * @param {string=} params.uom
 * @param {string=} params.timezone
 * @param {Array=} params.groups
 *
 * @returns {Object}
 */
export async function addUser({
    tenant,
    mail,
    uom,
    timezone,
    groups
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    const resolvedUom = (typeof uom === 'undefined') ? 'Metric' : uom;
    const resolvedTimezone = (typeof timezone === 'undefined') ? 'Etc/GMT+1' : timezone;
    const resolvedGroups = (typeof groups === 'undefined') ? [] : groups;
    const usersUrl = `${APS_BASE(tenant)}/api/v3/users`;

    try {
        const response = await httpRequest({
            method: 'POST',
            url: usersUrl,
            body: {
                email: mail,
                thumbnailPref: 'Yes',
                uomPref: resolvedUom,
                timezone: resolvedTimezone,
                licenseType: {
                    licenseCode: 'S' // P: Participant, S: Professional
                }
            }
        });

        if (typeof response.data === 'undefined') {
            response.data = {};
        }

        const userId = response.headers.location.split('/').pop();
        response.data.userId = userId;

        if (resolvedGroups.length === 0) {
            return response;
        }

        await httpRequest({
            method: 'POST',
            url: `${usersUrl}/${userId}/groups`,
            body: resolvedGroups
        });

        return response;

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * ASSIGN GROUPS TO USER
 *
 * Equivalent of POST /assign-groups
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {string|number} params.userId
 * @param {Array} params.groups
 *
 * @returns {Object}
 */
export async function assignGroups({
    tenant,
    userId,
    groups
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    if (!userId) {
        throw new Error('userId is required');
    }

    if (!Array.isArray(groups)) {
        throw new Error('groups must be an array');
    }

    const groupsUrl = `${APS_BASE(tenant)}/api/v3/users/${userId}/groups`;

    try {
        const response = await httpRequest({
            method: 'POST',
            url: groupsUrl,
            body: groups
        });

        return response;

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * UNASSIGN GROUP FROM USER
 *
 * Equivalent of POST /unassign-group
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {string|number} params.userId
 * @param {string|number} params.groupId
 *
 * @returns {Object}
 */
export async function unassignGroup({
    tenant,
    userId,
    groupId
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    if (!userId) {
        throw new Error('userId is required');
    }

    if (!groupId) {
        throw new Error('groupId is required');
    }

    const url = `${APS_BASE(tenant)}/api/rest/v1/users/${userId}/groups/${groupId}`;

    try {
        const response = await httpRequest({
            method: 'DELETE',
            url
        });

        return response;

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * GET ASSIGNED GROUPS (current user)
 *
 * Equivalent of GET /groups-assigned
 *
 * @param {Object} params
 * @param {string} params.tenant
 *
 * @returns {Object}
 * @returns {Array} returns.data
 */
export async function getAssignedGroups({
    tenant
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    const url = `${APS_BASE(tenant)}/api/v3/users/@me`;

    try {
        const response = await httpRequest({
            method: 'GET',
            url
        });

        return {
            data: response?.data?.groups ?? [],
            status: response?.status
        };

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * GET USER PROFILE (current user)
 *
 * Equivalent of GET /me
 *
 * @param {Object} params
 * @param {string} params.tenant
 *
 * @returns {Object}
 */
export async function getCurrentUserProfile({
    tenant
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    const url = `${APS_BASE(tenant)}/api/v3/users/@me`;

    try {
        const response = await httpRequest({
            method: 'GET',
            url
        });

        return response;

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * GET PERMISSIONS DEFINITION (V1)
 *
 * Equivalent of GET /permissions-definition
 *
 * @param {Object} params
 * @param {string} params.tenant
 *
 * @returns {Object}
 */
export async function getPermissionsDefinition({
   tenant
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    const url = `${APS_BASE(tenant)}/api/rest/v1/permissions`;

    try {
        const response = await httpRequest({
            method: 'GET',
            url
        });

        return response;

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * GET WORKSPACE / ITEM PERMISSIONS (current user)
 *
 * Equivalent of GET /permissions
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.wsId
 * @param {number=} params.dmsId
 * @param {string=} params.link
 *
 * @returns {Object}
 * @returns {Array} returns.data.permissions
 */
export async function getPermissions({
     tenant,
     wsId,
     dmsId,
     link
 }) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    let itemPath;

    if (link) {
        itemPath = link;
    } else {
        if (!wsId) {
            throw new Error('wsId is required when link is not provided');
        }

        itemPath = `/api/v3/workspaces/${wsId}`;

        if (typeof dmsId !== 'undefined') {
            itemPath += `/items/${dmsId}`;
        }
    }

    const url = `${APS_BASE(tenant)}${itemPath}/users/@me/permissions`;

    try {
        const response = await httpRequest({
            method: 'GET',
            url
        });

        return {
            data: response?.permissions ?? response?.data?.permissions ?? [],
            status: response?.status
        };

    } catch (error) {
        return error?.response ?? error;
    }
}

/**
 * SYSTEM LOGS
 *
 * Equivalent of GET /system-logs
 *
 * @param {Object} params
 * @param {string} params.tenant
 * @param {number=} params.offset
 * @param {number=} params.limit
 * @param {string|boolean=} params.extended
 *
 * @returns {Object}
 */
export async function getSystemLogs({
    tenant,
    offset,
    limit,
    extended
}) {
    if (!tenant) {
        throw new Error('tenant is required');
    }

    const resolvedOffset = (typeof offset === 'undefined') ? '' : offset;
    const resolvedLimit = (typeof limit  === 'undefined') ? '' : limit;
    const isExtended= (typeof extended === 'undefined') ? false : (extended === true || extended === 'true');

    let url =
        `${APS_BASE(tenant)}/api/v3/tenants/${tenant.toUpperCase()}` +
        `/system-logs?offset=${resolvedOffset}&limit=${resolvedLimit}`;

    if (isExtended) {
        url += '&type=item';
    }

    try {
        const response = await httpRequest({
            method: 'GET',
            url
        });

        return response;

    } catch (error) {
        return error?.response ?? error;
    }
}

