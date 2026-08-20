'use client'

import { Document, Page, Text, View, StyleSheet, PDFDownloadLink } from '@react-pdf/renderer'

interface ReportContent {
  summary: string
  periodLabel: string
  totalFeedback: number
  sentimentBreakdown: { pos: number; neu: number; neg: number }
  previousSentimentBreakdown: { pos: number; neu: number; neg: number }
  topThemes: { name: string; count: number; previousCount: number }[]
  notableQuotes: { content: string; sentiment: string | null; featureArea: string | null }[]
  recommendedActions: string[]
}

interface ReportSummary {
  id: string
  title: string
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: 'Helvetica', color: '#1F2937' },
  title: { fontSize: 20, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 11, color: '#6B7280', marginBottom: 24 },
  sectionHeader: { fontSize: 10, fontWeight: 700, color: '#9CA3AF', marginBottom: 8, marginTop: 20, textTransform: 'uppercase' },
  paragraph: { fontSize: 11, lineHeight: 1.5, marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  themeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  quoteBox: { marginBottom: 8, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: '#D1D5DB' },
  quoteText: { fontStyle: 'italic', fontSize: 11 },
  quoteMeta: { fontSize: 9, color: '#9CA3AF', marginTop: 2 },
  actionRow: { flexDirection: 'row', marginBottom: 6 },
  actionNumber: { width: 16, color: '#9CA3AF' },
})

function ReportPdfDocument({ report, content }: { report: ReportSummary; content: ReportContent }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{report.title}</Text>
        <Text style={styles.subtitle}>{content.periodLabel}</Text>

        <Text style={styles.sectionHeader}>Summary</Text>
        <Text style={styles.paragraph}>{content.summary}</Text>

        <Text style={styles.sectionHeader}>Sentiment ({content.totalFeedback} items this period)</Text>
        <View style={styles.row}>
          <Text>This period: {content.sentimentBreakdown.pos} pos / {content.sentimentBreakdown.neu} neu / {content.sentimentBreakdown.neg} neg</Text>
        </View>
        <View style={styles.row}>
          <Text>Previous period: {content.previousSentimentBreakdown.pos} pos / {content.previousSentimentBreakdown.neu} neu / {content.previousSentimentBreakdown.neg} neg</Text>
        </View>

        <Text style={styles.sectionHeader}>Top Themes</Text>
        {content.topThemes.map((t, i) => (
          <View key={i} style={styles.themeRow}>
            <Text>{t.name}</Text>
            <Text>{t.count} (was {t.previousCount})</Text>
          </View>
        ))}

        <Text style={styles.sectionHeader}>Notable Quotes</Text>
        {content.notableQuotes.map((q, i) => (
          <View key={i} style={styles.quoteBox}>
            <Text style={styles.quoteText}>"{q.content}"</Text>
            <Text style={styles.quoteMeta}>{q.sentiment ?? 'unclassified'} {q.featureArea ? `· ${q.featureArea}` : ''}</Text>
          </View>
        ))}

        <Text style={styles.sectionHeader}>Recommended Actions</Text>
        {content.recommendedActions.map((a, i) => (
          <View key={i} style={styles.actionRow}>
            <Text style={styles.actionNumber}>{i + 1}.</Text>
            <Text style={{ flex: 1 }}>{a}</Text>
          </View>
        ))}
      </Page>
    </Document>
  )
}

export default function DownloadPdfButton({ report, content }: { report: ReportSummary; content: ReportContent }) {
  return (
    <PDFDownloadLink
      document={<ReportPdfDocument report={report} content={content} />}
      fileName={`${report.title.replace(/[^a-z0-9]/gi, '-')}.pdf`}
      className="px-4 py-2 rounded-md border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
    >
      {({ loading }) => (loading ? 'Preparing PDF…' : 'Download PDF')}
    </PDFDownloadLink>
  )
}