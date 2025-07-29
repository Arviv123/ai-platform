#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError, } from '@modelcontextprotocol/sdk/types.js';
import fetch from 'node-fetch';
// Base URL for Iplan services
const BASE_URL = "https://ags.iplan.gov.il/arcgisiplan/rest/services";
class IplanMCPServer {
    server;
    constructor() {
        this.server = new Server({
            name: 'iplan-israel-planning',
            version: '1.0.0',
        }, {
            capabilities: {
                tools: {}
            }
        });
        this.setupToolHandlers();
    }
    setupToolHandlers() {
        // List available tools
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    {
                        name: 'search_plans',
                        description: 'חיפוש תכניות במינהל התכנון הישראלי עם פילטרים מתקדמים',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                searchTerm: {
                                    type: 'string',
                                    description: 'שם או מספר תכנית לחיפוש'
                                },
                                district: {
                                    type: 'string',
                                    description: 'מחוז (תל אביב, ירושלים, חיפה, מחוז הצפון, מחוז המרכז, מחוז הדרום)'
                                },
                                minArea: {
                                    type: 'number',
                                    description: 'שטח מינימלי בדונמים'
                                },
                                maxArea: {
                                    type: 'number',
                                    description: 'שטח מקסימלי בדונמים'
                                },
                                planAreaName: {
                                    type: 'string',
                                    description: 'אזור תכנית פנימי (לדוגמה: ירושלים מערב)'
                                },
                                cityName: {
                                    type: 'string',
                                    description: 'שם עיר או אזור סמכות (לדוגמה: עיריית תל אביב)'
                                },
                                landUse: {
                                    type: 'string',
                                    description: 'ייעוד קרקע (מגורים, מסחר, תעשיה, וכו\')'
                                },
                                minDate: {
                                    type: 'string',
                                    description: 'תאריך אישור מינימלי (YYYY-MM-DD)'
                                },
                                maxDate: {
                                    type: 'string',
                                    description: 'תאריך אישור מקסימלי (YYYY-MM-DD)'
                                },
                                minHousingUnits: {
                                    type: 'number',
                                    description: 'מספר יחידות דיור מינימלי'
                                },
                                maxHousingUnits: {
                                    type: 'number',
                                    description: 'מספר יחידות דיור מקסימלי'
                                },
                                minRoomsSqM: {
                                    type: 'number',
                                    description: 'שטח חדרים מינימלי במ״ר'
                                },
                                maxRoomsSqM: {
                                    type: 'number',
                                    description: 'שטח חדרים מקסימלי במ״ר'
                                },
                                minYear: {
                                    type: 'number',
                                    description: 'שנת אישור מינימלית'
                                },
                                maxYear: {
                                    type: 'number',
                                    description: 'שנת אישור מקסימלית'
                                }
                            }
                        }
                    },
                    {
                        name: 'get_plan_details',
                        description: 'קבלת פרטים מלאים על תכנית ספציפית לפי מספר תכנית',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                planNumber: {
                                    type: 'string',
                                    description: 'מספר התכנית הרשמי',
                                    required: true
                                }
                            },
                            required: ['planNumber']
                        }
                    },
                    {
                        name: 'search_by_location',
                        description: 'חיפוש תכניות לפי קואורדינטות גיאוגרפיות',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                x: {
                                    type: 'number',
                                    description: 'קואורדינטת X (מערכת ישראל TM)',
                                    required: true
                                },
                                y: {
                                    type: 'number',
                                    description: 'קואורדינטת Y (מערכת ישראל TM)',
                                    required: true
                                },
                                radius: {
                                    type: 'number',
                                    description: 'רדיוס חיפוש במטרים (ברירת מחדל: 500)',
                                    default: 500
                                }
                            },
                            required: ['x', 'y']
                        }
                    },
                    {
                        name: 'get_building_restrictions',
                        description: 'קבלת הגבלות בנייה לפי מיקום',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                x: {
                                    type: 'number',
                                    description: 'קואורדינטת X',
                                    required: true
                                },
                                y: {
                                    type: 'number',
                                    description: 'קואורדינטת Y',
                                    required: true
                                },
                                buffer: {
                                    type: 'number',
                                    description: 'רדיוס חיפוש במטרים',
                                    default: 100
                                }
                            },
                            required: ['x', 'y']
                        }
                    },
                    {
                        name: 'get_infrastructure_data',
                        description: 'קבלת מידע על תשתיות (דרכים, רכבות, גז)',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                infrastructureType: {
                                    type: 'string',
                                    description: 'סוג תשתית: roads, trains, gas, all',
                                    enum: ['roads', 'trains', 'gas', 'all'],
                                    default: 'all'
                                },
                                whereClause: {
                                    type: 'string',
                                    description: 'תנאי מתקדם לחיפוש (SQL WHERE clause)',
                                    default: '1=1'
                                }
                            }
                        }
                    },
                    {
                        name: 'get_conservation_sites',
                        description: 'חיפוש אתרי שימור והגנה',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                x: {
                                    type: 'number',
                                    description: 'קואורדינטת X (אופציונלי)'
                                },
                                y: {
                                    type: 'number',
                                    description: 'קואורדינטת Y (אופציונלי)'
                                },
                                radius: {
                                    type: 'number',
                                    description: 'רדיוס חיפוש במטרים',
                                    default: 1000
                                },
                                conservationGrade: {
                                    type: 'string',
                                    description: 'דרגת שימור (א, ב, ג)'
                                }
                            }
                        }
                    },
                    {
                        name: 'get_comprehensive_location_data',
                        description: 'קבלת מידע מקיף על מיקום - תכניות, הגבלות, תשתיות ויישובים',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                x: {
                                    type: 'number',
                                    description: 'קואורדינטת X',
                                    required: true
                                },
                                y: {
                                    type: 'number',
                                    description: 'קואורדינטת Y',
                                    required: true
                                },
                                radius: {
                                    type: 'number',
                                    description: 'רדיוס חיפוש במטרים',
                                    default: 500
                                }
                            },
                            required: ['x', 'y']
                        }
                    },
                    {
                        name: 'check_service_status',
                        description: 'בדיקת זמינות השירותים של מינהל התכנון',
                        inputSchema: {
                            type: 'object',
                            properties: {}
                        }
                    }
                ]
            };
        });
        // Handle tool calls
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            try {
                switch (name) {
                    case 'search_plans':
                        return await this.searchPlans(args);
                    case 'get_plan_details':
                        return await this.getPlanDetails(args?.planNumber);
                    case 'search_by_location':
                        return await this.searchByLocation(args?.x, args?.y, args?.radius);
                    case 'get_building_restrictions':
                        return await this.getBuildingRestrictions(args?.x, args?.y, args?.buffer);
                    case 'get_infrastructure_data':
                        return await this.getInfrastructureData(args?.infrastructureType, args?.whereClause);
                    case 'get_conservation_sites':
                        return await this.getConservationSites(args);
                    case 'get_comprehensive_location_data':
                        return await this.getComprehensiveLocationData(args?.x, args?.y, args?.radius);
                    case 'check_service_status':
                        return await this.checkServiceStatus();
                    default:
                        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
                }
            }
            catch (error) {
                if (error instanceof McpError) {
                    throw error;
                }
                throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
    }
    buildWhereClause(params) {
        const conditions = [];
        if (params.searchTerm) {
            conditions.push(`(pl_name LIKE '%${params.searchTerm}%' OR pl_number LIKE '%${params.searchTerm}%')`);
        }
        if (params.district) {
            conditions.push(`district_name LIKE '%${params.district}%'`);
        }
        if (params.minArea) {
            conditions.push(`pl_area_dunam >= ${params.minArea}`);
        }
        if (params.maxArea) {
            conditions.push(`pl_area_dunam <= ${params.maxArea}`);
        }
        if (params.planAreaName) {
            conditions.push(`plan_area_name LIKE '%${params.planAreaName}%'`);
        }
        if (params.cityName) {
            conditions.push(`jurstiction_area_name LIKE '%${params.cityName}%'`);
        }
        if (params.landUse) {
            conditions.push(`pl_landuse_string LIKE '%${params.landUse}%'`);
        }
        if (params.minDate) {
            conditions.push(`pl_date_8 >= '${params.minDate.replace(/-/g, '')}'`);
        }
        if (params.maxDate) {
            conditions.push(`pl_date_8 <= '${params.maxDate.replace(/-/g, '')}'`);
        }
        if (params.minHousingUnits) {
            conditions.push(`pq_authorised_quantity_120 >= ${params.minHousingUnits}`);
        }
        if (params.maxHousingUnits) {
            conditions.push(`pq_authorised_quantity_120 <= ${params.maxHousingUnits}`);
        }
        if (params.minRoomsSqM) {
            conditions.push(`pq_authorised_quantity_105 >= ${params.minRoomsSqM}`);
        }
        if (params.maxRoomsSqM) {
            conditions.push(`pq_authorised_quantity_105 <= ${params.maxRoomsSqM}`);
        }
        if (params.minYear) {
            conditions.push(`pl_date_8 >= '${params.minYear}0101'`);
        }
        if (params.maxYear) {
            conditions.push(`pl_date_8 <= '${params.maxYear}1231'`);
        }
        return conditions.length > 0 ? conditions.join(' AND ') : '1=1';
    }
    async searchPlans(params) {
        const whereClause = this.buildWhereClause(params);
        const url = `${BASE_URL}/PlanningPublic/Xplan/MapServer/1/query`;
        const searchParams = new URLSearchParams({
            'where': whereClause,
            'outFields': 'pl_name,pl_number,district_name,plan_area_name,pl_area_dunam,pl_date_8,pl_url,jurstiction_area_name,pl_landuse_string,pq_authorised_quantity_105,pq_authorised_quantity_110,pq_authorised_quantity_120',
            'f': 'json',
            'returnGeometry': 'false'
        });
        const response = await fetch(`${url}?${searchParams}`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (data?.error) {
            throw new Error(`API Error: ${data.error.message}`);
        }
        const results = data?.features || [];
        return {
            content: [
                {
                    type: 'text',
                    text: `נמצאו ${results.length} תוצאות:\n\n${JSON.stringify(results, null, 2)}`
                }
            ]
        };
    }
    async getPlanDetails(planNumber) {
        const whereClause = `pl_number LIKE '%${planNumber}%'`;
        const url = `${BASE_URL}/PlanningPublic/Xplan/MapServer/1/query`;
        const params = new URLSearchParams({
            'where': whereClause,
            'outFields': '*',
            'f': 'json',
            'returnGeometry': 'true'
        });
        const response = await fetch(`${url}?${params}`);
        const data = await response.json();
        if (data?.error) {
            throw new Error(`API Error: ${data.error.message}`);
        }
        return {
            content: [
                {
                    type: 'text',
                    text: `פרטי תכנית ${planNumber}:\n\n${JSON.stringify(data?.features, null, 2)}`
                }
            ]
        };
    }
    async searchByLocation(x, y, radius = 500) {
        const url = `${BASE_URL}/PlanningPublic/Xplan/MapServer/1/query`;
        const params = new URLSearchParams({
            'geometry': `{"x":${x},"y":${y}}`,
            'geometryType': 'esriGeometryPoint',
            'spatialRel': 'esriSpatialRelWithin',
            'distance': radius.toString(),
            'units': 'esriSRUnit_Meter',
            'outFields': '*',
            'f': 'json',
            'returnGeometry': 'false'
        });
        const response = await fetch(`${url}?${params}`);
        const data = await response.json();
        if (data?.error) {
            throw new Error(`API Error: ${data.error.message}`);
        }
        return {
            content: [
                {
                    type: 'text',
                    text: `תכניות בקרבת הנקודה (${x}, ${y}) ברדיוס ${radius}מ':\n\n${JSON.stringify(data?.features, null, 2)}`
                }
            ]
        };
    }
    async getBuildingRestrictions(x, y, buffer = 100) {
        const services = [
            'gvulot_retzef',
            'Shimour',
            'functional_area_ezoriyut_str'
        ];
        const results = {};
        for (const service of services) {
            try {
                const url = `${BASE_URL}/PlanningPublic/${service}/MapServer/0/query`;
                const params = new URLSearchParams({
                    'geometry': `{"x":${x},"y":${y}}`,
                    'geometryType': 'esriGeometryPoint',
                    'spatialRel': 'esriSpatialRelWithin',
                    'distance': buffer.toString(),
                    'units': 'esriSRUnit_Meter',
                    'outFields': '*',
                    'f': 'json',
                    'returnGeometry': 'false'
                });
                const response = await fetch(`${url}?${params}`);
                const data = await response.json();
                results[service] = data?.features || [];
            }
            catch (error) {
                results[service] = { error: error instanceof Error ? error.message : String(error) };
            }
        }
        return {
            content: [
                {
                    type: 'text',
                    text: `הגבלות בנייה בנקודה (${x}, ${y}):\n\n${JSON.stringify(results, null, 2)}`
                }
            ]
        };
    }
    async getInfrastructureData(infrastructureType = 'all', whereClause = '1=1') {
        const infrastructureTypes = {
            roads: 'road_compilation',
            trains: 'train_compilation',
            gas: 'gaz_compilation'
        };
        const results = {};
        const typesToQuery = infrastructureType === 'all' ?
            Object.entries(infrastructureTypes) :
            [[infrastructureType, infrastructureTypes[infrastructureType]]];
        for (const [type, service] of typesToQuery) {
            if (!service)
                continue;
            try {
                const url = `${BASE_URL}/PlanningPublic/${service}/MapServer/0/query`;
                const params = new URLSearchParams({
                    'where': whereClause,
                    'outFields': '*',
                    'f': 'json',
                    'returnGeometry': 'false'
                });
                const response = await fetch(`${url}?${params}`);
                const data = await response.json();
                results[type] = data?.features || [];
            }
            catch (error) {
                results[type] = { error: error instanceof Error ? error.message : String(error) };
            }
        }
        return {
            content: [
                {
                    type: 'text',
                    text: `נתוני תשתיות:\n\n${JSON.stringify(results, null, 2)}`
                }
            ]
        };
    }
    async getConservationSites(args) {
        const { x, y, radius = 1000, conservationGrade } = args || {};
        let whereClause = '1=1';
        if (conservationGrade) {
            whereClause += ` AND conservation_grade LIKE '%${conservationGrade}%'`;
        }
        const url = `${BASE_URL}/PlanningPublic/Shimour/MapServer/0/query`;
        let params;
        if (x && y) {
            params = new URLSearchParams({
                'geometry': `{"x":${x},"y":${y}}`,
                'geometryType': 'esriGeometryPoint',
                'spatialRel': 'esriSpatialRelWithin',
                'distance': radius.toString(),
                'units': 'esriSRUnit_Meter',
                'where': whereClause,
                'outFields': '*',
                'f': 'json',
                'returnGeometry': 'false'
            });
        }
        else {
            params = new URLSearchParams({
                'where': whereClause,
                'outFields': '*',
                'f': 'json',
                'returnGeometry': 'false'
            });
        }
        const response = await fetch(`${url}?${params}`);
        const data = await response.json();
        if (data?.error) {
            throw new Error(`API Error: ${data.error.message}`);
        }
        return {
            content: [
                {
                    type: 'text',
                    text: `אתרי שימור:\n\n${JSON.stringify(data?.features, null, 2)}`
                }
            ]
        };
    }
    async getComprehensiveLocationData(x, y, radius = 500) {
        const results = {};
        try {
            // תכניות תכנון
            const plansResponse = await fetch(`${BASE_URL}/PlanningPublic/Xplan/MapServer/1/query?geometry={"x":${x},"y":${y}}&geometryType=esriGeometryPoint&spatialRel=esriSpatialRelWithin&distance=${radius}&units=esriSRUnit_Meter&outFields=*&f=json`);
            const plansData = await plansResponse.json();
            results.plans = plansData?.features || [];
            // הגבלות בנייה
            const restrictions = await this.getBuildingRestrictions(x, y, radius);
            const restrictionsText = restrictions.content[0].text;
            const restrictionsJson = restrictionsText.split(':\n\n')[1];
            try {
                results.restrictions = JSON.parse(restrictionsJson);
            }
            catch {
                results.restrictions = restrictionsJson;
            }
            // תשתיות
            const infrastructure = await this.getInfrastructureData('all');
            const infrastructureText = infrastructure.content[0].text;
            const infrastructureJson = infrastructureText.split(':\n\n')[1];
            try {
                results.infrastructure = JSON.parse(infrastructureJson);
            }
            catch {
                results.infrastructure = infrastructureJson;
            }
            // יישובים
            const entitiesResponse = await fetch(`${BASE_URL}/PlanningPublic/entities/MapServer/1/query?geometry={"x":${x},"y":${y}}&geometryType=esriGeometryPoint&spatialRel=esriSpatialRelWithin&distance=${radius}&units=esriSRUnit_Meter&outFields=*&f=json`);
            const entitiesData = await entitiesResponse.json();
            results.entities = entitiesData?.features || [];
        }
        catch (error) {
            results.error = error instanceof Error ? error.message : String(error);
        }
        return {
            content: [
                {
                    type: 'text',
                    text: `מידע מקיף עבור נקודה (${x}, ${y}) ברדיוס ${radius}מ':\n\n${JSON.stringify({
                        location: { x, y, radius },
                        ...results
                    }, null, 2)}`
                }
            ]
        };
    }
    async checkServiceStatus() {
        const services = [
            'PlanningPublic/Xplan',
            'PlanningPublic/entities',
            'PlanningPublic/plan_index',
            'PlanningPublic/gvulot_retzef',
            'PlanningPublic/Shimour',
            'PlanningPublic/road_compilation',
            'PlanningPublic/train_compilation',
            'PlanningPublic/gaz_compilation'
        ];
        const results = {};
        // Check main server info
        try {
            const mainResponse = await fetch(`${BASE_URL}?f=json`);
            const mainData = await mainResponse.json();
            results.server_info = {
                status: 'active',
                version: mainData?.currentVersion,
                services_available: mainData?.services?.length || 0
            };
        }
        catch (error) {
            results.server_info = {
                status: 'error',
                error: error instanceof Error ? error.message : String(error)
            };
        }
        // Check individual services
        results.services = {};
        for (const service of services) {
            try {
                const response = await fetch(`${BASE_URL}/${service}/MapServer?f=json`);
                if (response.ok) {
                    const data = await response.json();
                    results.services[service] = {
                        status: 'active',
                        layers: data?.layers?.length || 0,
                        description: data?.serviceDescription || 'N/A'
                    };
                }
                else {
                    results.services[service] = {
                        status: 'error',
                        http_status: response.status
                    };
                }
            }
            catch (error) {
                results.services[service] = {
                    status: 'error',
                    error: error instanceof Error ? error.message : String(error)
                };
            }
        }
        return {
            content: [
                {
                    type: 'text',
                    text: `סטטוס שירותי מינהל התכנון:\n\n${JSON.stringify(results, null, 2)}`
                }
            ]
        };
    }
    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('Iplan MCP server running on stdio');
    }
}
const server = new IplanMCPServer();
server.run().catch(console.error);