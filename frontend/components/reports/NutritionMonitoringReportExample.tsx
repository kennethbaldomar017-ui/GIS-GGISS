'use client';

import React from 'react';
import { NutritionMonitoringReport } from './NutritionMonitoringReport';

/**
 * Example usage of the NutritionMonitoringReport component
 * This demonstrates how to pass data to the comprehensive 13-chapter report
 */
export function NutritionMonitoringReportExample() {
  // Sample data structure for the nutrition report
  const reportData = {
    executiveSummary: {
      summary:
        'Comprehensive nutrition monitoring report showing strong program performance with 79.2% of children maintaining normal nutritional status.',
      kpis: [
        {
          label: 'Total Children Monitored',
          value: '1,245',
          unit: 'children',
          change: 8,
          trend: 'up' as const,
          status: 'positive' as const,
        },
        {
          label: 'Nutritional Status',
          value: '87%',
          unit: 'normal range',
          change: 5,
          trend: 'up' as const,
          status: 'positive' as const,
        },
        {
          label: 'At-Risk Children',
          value: '156',
          unit: 'children',
          change: 12,
          trend: 'down' as const,
          status: 'positive' as const,
        },
        {
          label: 'Program Coverage',
          value: '92%',
          unit: 'target reached',
          change: 3,
          trend: 'up' as const,
          status: 'positive' as const,
        },
      ],
      highlights: [
        'Successfully monitored nutritional status of 1,245 children across all barangays',
        'Achieved 92% program coverage, exceeding the 85% target',
        'Identified and referred 156 at-risk children for intervention',
        'Implemented 42 targeted nutrition programs with 89% compliance rate',
      ],
      keyMessages: [
        'Overall nutritional status has improved by 5% compared to the previous period',
        'Geographic hotspots identified in 3 barangays require intensified interventions',
        'Early warning system detected 23 potential nutrition-related incidents',
        'Intervention effectiveness rate stands at 78%, indicating strong program impact',
      ],
    },

    cityOverview: {
      demographics: {
        totalPopulation: 285450,
        childrenUnder5: 28545,
        totalHouseholds: 47575,
        barangayCount: 17,
        geographicArea: '315.42 km²',
        populationDensity: '904 persons/km²',
      },
      profile: {
        cityName: 'Calinog',
        region: 'Western Visayas',
        province: 'Iloilo',
        geographicCharacteristics: [
          'Situated in the northwestern portion of Iloilo',
          'Terrain mostly undulating to hilly',
          'Tropical climate with two distinct seasons',
        ],
        socioeconomicFactors: [
          'Primary industries: agriculture and fishing',
          'Moderate income levels with poverty incidence of 18.5%',
          'Limited access to healthcare in remote barangays',
        ],
      },
    },

    childNutritional: {
      totalChildren: 1245,
      statusBreakdown: [
        { status: 'Normal', count: 987, percentage: 79.2 },
        { status: 'At Risk', count: 178, percentage: 14.3 },
        { status: 'Moderate Malnutrition', count: 65, percentage: 5.2 },
        { status: 'Severe Malnutrition', count: 15, percentage: 1.2 },
      ],
    },

    barangayComparative: {
      barangays: [
        {
          name: 'Barangay A',
          totalChildren: 95,
          normal: 78,
          atRisk: 14,
          severe: 3,
          riskScore: 35,
          riskLevel: 'Medium' as const,
          complianceRate: 92,
        },
        {
          name: 'Barangay B',
          totalChildren: 112,
          normal: 102,
          atRisk: 8,
          severe: 2,
          riskScore: 18,
          riskLevel: 'Low' as const,
          complianceRate: 95,
        },
        {
          name: 'Barangay C',
          totalChildren: 78,
          normal: 58,
          atRisk: 15,
          severe: 5,
          riskScore: 62,
          riskLevel: 'High' as const,
          complianceRate: 78,
        },
      ],
    },

    gisHotspot: {
      hotspots: [
        {
          name: 'Zone A - Northern Cluster',
          latitude: 9.1250,
          longitude: 125.5600,
          intensity: 92,
          caseCount: 125,
          radius: 2.5,
          description: 'Highest concentration of nutrition cases',
        },
        {
          name: 'Zone B - Central Area',
          latitude: 9.1180,
          longitude: 125.5650,
          intensity: 67,
          caseCount: 89,
          radius: 2.0,
          description: 'Moderate risk area with growing trend',
        },
      ],
    },

    programAccomplishment: {
      summary: 'Program implementation achieved 97.6% success rate with strong target achievement.',
      metrics: [
        {
          name: 'Growth Monitoring Sessions',
          target: 480,
          accomplished: 467,
          unit: 'sessions',
          status: 'on-track' as const,
        },
        {
          name: 'Nutrition Education Programs',
          target: 52,
          accomplished: 52,
          unit: 'programs',
          status: 'completed' as const,
        },
      ],
    },

    interventionEffectiveness: {
      outcomes: [
        {
          intervention: 'Supplementary Feeding Program',
          baseLine: 62,
          target: 75,
          actual: 78,
          effectiveness: 104,
        },
        {
          intervention: 'Nutrition Education Sessions',
          baseLine: 55,
          target: 70,
          actual: 67,
          effectiveness: 96,
        },
      ],
    },

    alertIncident: {
      alertStatistics: [
        { type: 'Severe Malnutrition', count: 38, responseTime: '2.4 hrs', resolutionRate: 92 },
        { type: 'Moderate Malnutrition', count: 92, responseTime: '4.2 hrs', resolutionRate: 88 },
      ],
    },

    forecasting: {
      seasonalPatterns: [
        'Nutrition status typically declines during lean months (May-August)',
        'Improvement observed post-harvest season (September-January)',
        'Higher malnutrition rates correlate with increased food prices',
      ],
    },

    decisionSupport: {
      recommendations: [
        {
          priority: 'High' as const,
          title: 'Scale-up Supplementary Feeding Program',
          description: 'Expand SFP to include an additional 150 malnourished children.',
          targetArea: 'Barangays A, C, D',
          expectedOutcome: '25% improvement in nutritional status within 6 months',
        },
      ],
      strategicPriorities: [
        'Focus on the identified hotspot zones',
        'Strengthen community health worker capacity',
      ],
    },

    barangayCompliance: {
      complianceData: [
        {
          barangay: 'Barangay A',
          programAccess: 95,
          monthlyReporting: 92,
          referralFollowUp: 89,
          immunizationRate: 91,
          growthMonitoring: 88,
          overallScore: 91,
        },
        {
          barangay: 'Barangay B',
          programAccess: 92,
          monthlyReporting: 90,
          referralFollowUp: 87,
          immunizationRate: 89,
          growthMonitoring: 85,
          overallScore: 89,
        },
      ],
    },

    conclusion: {
      executiveSummary:
        'The nutrition monitoring system has demonstrated strong implementation capacity with measurable improvements in child nutritional outcomes.',
      mainFindings: [
        '79.2% of children maintain normal nutritional status',
        'Program accomplishment rate stands at 97.6%',
        'Geographic hotspot analysis identified 4 intervention zones',
      ],
    },

    appendices: {
      appendices: [
        {
          title: 'Appendix A: Data Collection Methodology',
          content: 'Details of survey design, measurement tools, and data validation procedures.',
        },
        {
          title: 'Appendix B: WHO Z-Score Reference Standards',
          content: 'Classification criteria for nutritional assessment based on WHO standards.',
        },
      ],
      glossary: {
        BMI: 'Body Mass Index',
        CHW: 'Community Health Worker',
        GIS: 'Geographic Information System',
      },
      references: [
        'WHO (2006). WHO Child Growth Standards',
        'Department of Health Philippines (2022). National Nutrition Survey Report',
      ],
    },
  };

  return (
    <NutritionMonitoringReport
      data={reportData}
      title="Nutrition Monitoring Report - Calinog, Iloilo"
      generatedDate={new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}
    />
  );
}
