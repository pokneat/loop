export default function ReportViewLoading() {
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="h-4 w-24 bg-gray-100 rounded animate-pulse mb-6" />
      <div className="h-7 w-80 bg-gray-200 rounded animate-pulse mb-2" />
      <div className="h-4 w-40 bg-gray-100 rounded animate-pulse mb-8" />
      <div className="h-4 w-24 bg-gray-100 rounded animate-pulse mb-2" />
      <div className="h-16 bg-gray-100 rounded animate-pulse mb-8" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="h-20 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-20 bg-gray-100 rounded-lg animate-pulse" />
      </div>
    </div>
  )
}