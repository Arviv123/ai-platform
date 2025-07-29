// Use built-in fetch for Node.js 20+
const logger = require('../utils/logger');

// Base URL for Iplan services
const BASE_URL = "https://ags.iplan.gov.il/arcgisiplan/rest/services";

class IsraeliPlanningService {
  constructor() {
    this.tools = {
      search_plans: {
        name: 'search_plans',
        description: 'חיפוש תכניות במינהל התכנון הישראלי עם פילטרים מתקדמים',
        parameters: {
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
      get_plan_details: {
        name: 'get_plan_details',
        description: 'קבלת פרטים מלאים על תכנית ספציפית לפי מספר תכנית',
        parameters: {
          type: 'object',
          properties: {
            planNumber: {
              type: 'string',
              description: 'מספר התכנית הרשמי'
            }
          },
          required: ['planNumber']
        }
      },
      search_by_location: {
        name: 'search_by_location',
        description: 'חיפוש תכניות לפי קואורדינטות גיאוגרפיות',
        parameters: {
          type: 'object',
          properties: {
            x: {
              type: 'number',
              description: 'קואורדינטת X (מערכת ישראל TM)'
            },
            y: {
              type: 'number',
              description: 'קואורדינטת Y (מערכת ישראל TM)'
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
      get_comprehensive_location_data: {
        name: 'get_comprehensive_location_data',
        description: 'קבלת מידע מקיף על מיקום - תכניות, הגבלות, תשתיות ויישובים',
        parameters: {
          type: 'object',
          properties: {
            x: {
              type: 'number',
              description: 'קואורדינטת X'
            },
            y: {
              type: 'number',
              description: 'קואורדינטת Y'
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
      check_service_status: {
        name: 'check_service_status',
        description: 'בדיקת זמינות השירותים של מינהל התכנון',
        parameters: {
          type: 'object',
          properties: {}
        }
      }
    };
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
    if (params.minYear) {
      conditions.push(`pl_date_8 >= '${params.minYear}0101'`);
    }
    if (params.maxYear) {
      conditions.push(`pl_date_8 <= '${params.maxYear}1231'`);
    }
    
    return conditions.length > 0 ? conditions.join(' AND ') : '1=1';
  }

  async searchPlans(params) {
    try {
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
      logger.info(`Planning search returned ${results.length} results`);
      
      return `נמצאו ${results.length} תכניות:\n\n${results.map(feature => {
        const attrs = feature.attributes;
        return `📋 תכנית ${attrs.pl_number || 'N/A'}\n` +
               `   שם: ${attrs.pl_name || 'לא מוגדר'}\n` +
               `   מחוז: ${attrs.district_name || 'לא מוגדר'}\n` +
               `   שטח: ${attrs.pl_area_dunam || 'לא מוגדר'} דונם\n` +
               `   תאריך אישור: ${attrs.pl_date_8 || 'לא מוגדר'}\n` +
               `   סמכות: ${attrs.jurstiction_area_name || 'לא מוגדר'}\n` +
               `   ייעוד: ${attrs.pl_landuse_string || 'לא מוגדר'}\n` +
               `   יחידות דיור: ${attrs.pq_authorised_quantity_120 || 'לא מוגדר'}\n`;
      }).join('\n')}`;
      
    } catch (error) {
      logger.error('Error in searchPlans:', error);
      throw new Error(`שגיאה בחיפוש תכניות: ${error.message}`);
    }
  }

  async getPlanDetails(planNumber) {
    try {
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

      const features = data?.features || [];
      if (features.length === 0) {
        return `לא נמצאה תכנית עם המספר ${planNumber}`;
      }

      logger.info(`Plan details retrieved for ${planNumber}`);
      
      return features.map(feature => {
        const attrs = feature.attributes;
        return `📋 פרטי תכנית מלאים - ${planNumber}\n\n` +
               `שם התכנית: ${attrs.pl_name || 'לא מוגדר'}\n` +
               `מספר תכנית: ${attrs.pl_number || 'לא מוגדר'}\n` +
               `מחוז: ${attrs.district_name || 'לא מוגדר'}\n` +
               `אזור תכנית: ${attrs.plan_area_name || 'לא מוגדר'}\n` +
               `שטח: ${attrs.pl_area_dunam || 'לא מוגדר'} דונם\n` +
               `תאריך אישור: ${attrs.pl_date_8 || 'לא מוגדר'}\n` +
               `סמכות תכנון: ${attrs.jurstiction_area_name || 'לא מוגדר'}\n` +
               `ייעוד קרקע: ${attrs.pl_landuse_string || 'לא מוגדר'}\n` +
               `יחידות דיור מאושרות: ${attrs.pq_authorised_quantity_120 || 'לא מוגדר'}\n` +
               `שטח חדרים מאושר: ${attrs.pq_authorised_quantity_105 || 'לא מוגדר'} מ"ר\n` +
               `קישור: ${attrs.pl_url || 'לא זמין'}\n`;
      }).join('\n\n');
      
    } catch (error) {
      logger.error('Error in getPlanDetails:', error);
      throw new Error(`שגיאה בקבלת פרטי תכנית: ${error.message}`);
    }
  }

  async searchByLocation(x, y, radius = 500) {
    try {
      const url = `${BASE_URL}/PlanningPublic/Xplan/MapServer/1/query`;
      
      const params = new URLSearchParams({
        'geometry': `{"x":${x},"y":${y}}`,
        'geometryType': 'esriGeometryPoint',
        'spatialRel': 'esriSpatialRelWithin',
        'distance': radius.toString(),
        'units': 'esriSRUnit_Meter',
        'outFields': 'pl_name,pl_number,district_name,plan_area_name,pl_area_dunam,pl_date_8,jurstiction_area_name,pl_landuse_string',
        'f': 'json',
        'returnGeometry': 'false'
      });

      const response = await fetch(`${url}?${params}`);
      const data = await response.json();
      
      if (data?.error) {
        throw new Error(`API Error: ${data.error.message}`);
      }

      const results = data?.features || [];
      logger.info(`Location search returned ${results.length} results for (${x}, ${y})`);
      
      return `תכניות בקרבת הנקודה (${x}, ${y}) ברדיוס ${radius} מטר:\n\n` +
             (results.length === 0 ? 'לא נמצאו תכניות באזור זה' :
             results.map(feature => {
               const attrs = feature.attributes;
               return `📍 תכנית ${attrs.pl_number || 'N/A'}\n` +
                      `   שם: ${attrs.pl_name || 'לא מוגדר'}\n` +
                      `   מחוז: ${attrs.district_name || 'לא מוגדר'}\n` +
                      `   שטח: ${attrs.pl_area_dunam || 'לא מוגדר'} דונם\n` +
                      `   ייעוד: ${attrs.pl_landuse_string || 'לא מוגדר'}\n`;
             }).join('\n'));
      
    } catch (error) {
      logger.error('Error in searchByLocation:', error);
      throw new Error(`שגיאה בחיפוש לפי מיקום: ${error.message}`);
    }
  }

  async getComprehensiveLocationData(x, y, radius = 500) {
    try {
      const results = {};
      
      // תכניות תכנון
      const plansResponse = await fetch(
        `${BASE_URL}/PlanningPublic/Xplan/MapServer/1/query?geometry={"x":${x},"y":${y}}&geometryType=esriGeometryPoint&spatialRel=esriSpatialRelWithin&distance=${radius}&units=esriSRUnit_Meter&outFields=*&f=json`
      );
      const plansData = await plansResponse.json();
      results.plans = plansData?.features || [];

      // יישובים
      const entitiesResponse = await fetch(
        `${BASE_URL}/PlanningPublic/entities/MapServer/1/query?geometry={"x":${x},"y":${y}}&geometryType=esriGeometryPoint&spatialRel=esriSpatialRelWithin&distance=${radius}&units=esriSRUnit_Meter&outFields=*&f=json`
      );
      const entitiesData = await entitiesResponse.json();
      results.entities = entitiesData?.features || [];

      logger.info(`Comprehensive location data retrieved for (${x}, ${y})`);
      
      return `מידע מקיף עבור נקודה (${x}, ${y}) ברדיוס ${radius} מטר:\n\n` +
             `📋 תכניות תכנון: ${results.plans.length} נמצאו\n` +
             `🏘️ יישובים: ${results.entities.length} נמצאו\n\n` +
             (results.plans.length > 0 ? 
               `תכניות:\n${results.plans.slice(0, 5).map(p => 
                 `• ${p.attributes.pl_name || p.attributes.pl_number || 'ללא שם'}`
               ).join('\n')}\n\n` : '') +
             (results.entities.length > 0 ? 
               `יישובים:\n${results.entities.slice(0, 5).map(e => 
                 `• ${e.attributes.entity_name || 'ללא שם'}`
               ).join('\n')}\n` : '');
      
    } catch (error) {
      logger.error('Error in getComprehensiveLocationData:', error);
      throw new Error(`שגיאה בקבלת מידע מקיף: ${error.message}`);
    }
  }

  async checkServiceStatus() {
    try {
      const services = [
        'PlanningPublic/Xplan',
        'PlanningPublic/entities',
        'PlanningPublic/plan_index',
        'PlanningPublic/gvulot_retzef',
        'PlanningPublic/Shimour'
      ];

      const results = {};
      
      // Check main server info
      try {
        const mainResponse = await fetch(`${BASE_URL}?f=json`);
        const mainData = await mainResponse.json();
        results.server_info = {
          status: 'פעיל',
          version: mainData?.currentVersion,
          services_available: mainData?.services?.length || 0
        };
      } catch (error) {
        results.server_info = {
          status: 'שגיאה',
          error: error.message
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
              status: 'פעיל',
              layers: data?.layers?.length || 0,
              description: data?.serviceDescription || 'N/A'
            };
          } else {
            results.services[service] = {
              status: 'שגיאה',
              http_status: response.status
            };
          }
        } catch (error) {
          results.services[service] = {
            status: 'שגיאה',
            error: error.message
          };
        }
      }

      logger.info('Service status checked');
      
      return `סטטוס שירותי מינהל התכנון:\n\n` +
             `🖥️ סטטוס שרת ראשי: ${results.server_info.status}\n` +
             `📊 שירותים זמינים: ${results.server_info.services_available || 0}\n\n` +
             `שירותים:\n${Object.entries(results.services).map(([service, info]) => 
               `• ${service}: ${info.status}${info.layers ? ` (${info.layers} שכבות)` : ''}`
             ).join('\n')}`;
      
    } catch (error) {
      logger.error('Error in checkServiceStatus:', error);
      throw new Error(`שגיאה בבדיקת סטטוס שירותים: ${error.message}`);
    }
  }

  async executeTool(toolName, parameters) {
    try {
      switch (toolName) {
        case 'search_plans':
          return await this.searchPlans(parameters);
        case 'get_plan_details':
          return await this.getPlanDetails(parameters.planNumber);
        case 'search_by_location':
          return await this.searchByLocation(parameters.x, parameters.y, parameters.radius);
        case 'get_comprehensive_location_data':
          return await this.getComprehensiveLocationData(parameters.x, parameters.y, parameters.radius);
        case 'check_service_status':
          return await this.checkServiceStatus();
        default:
          throw new Error(`כלי לא מוכר: ${toolName}`);
      }
    } catch (error) {
      logger.error(`Error executing tool ${toolName}:`, error);
      throw error;
    }
  }

  getAvailableTools() {
    return Object.values(this.tools);
  }

  isValidTool(toolName) {
    return this.tools.hasOwnProperty(toolName);
  }
}

module.exports = IsraeliPlanningService;