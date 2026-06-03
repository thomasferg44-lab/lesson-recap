const DURATIONS = ['30 min', '45 min', '1 hour', '1.5 hours', '2 hours']

const labelClass = 'block text-sm font-medium text-gray-600 uppercase tracking-wide mb-1'
const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white input-focus'

export default function StudentForm({ studentInfo, onUpdate, config, error }) {
  return (
    <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
        Lesson Details
      </h2>

      <div className="space-y-4">
        {/* Student Name */}
        <div>
          <label className={labelClass}>
            Student Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={studentInfo.studentName}
            onChange={(e) => onUpdate('studentName', e.target.value)}
            placeholder="e.g. Jamie Smith"
            className={inputClass}
          />
          {error && (
            <p className="mt-1 text-xs text-red-600">{error}</p>
          )}
        </div>

        {/* Coach */}
        <div>
          <label className={labelClass}>Coach</label>
          <select
            value={studentInfo.coachName}
            onChange={(e) => onUpdate('coachName', e.target.value)}
            className={inputClass}
          >
            {config.coaches.map((coach) => (
              <option key={coach} value={coach}>{coach}</option>
            ))}
          </select>
        </div>

        {/* Lesson Type */}
        <div>
          <label className={labelClass}>Lesson Type</label>
          <select
            value={studentInfo.lessonType}
            onChange={(e) => onUpdate('lessonType', e.target.value)}
            className={inputClass}
          >
            {config.lessonTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        {/* Duration */}
        <div>
          <label className={labelClass}>Duration</label>
          <select
            value={studentInfo.duration}
            onChange={(e) => onUpdate('duration', e.target.value)}
            className={inputClass}
          >
            {DURATIONS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {/* Date — read-only */}
        <p className="text-xs text-gray-400">Lesson date: {studentInfo.date}</p>
      </div>
    </div>
  )
}
