"use client";
import "@/styles/admin.css";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import {
  Calendar,
  Plus,
  ChevronLeft,
  ChevronRight,
  Target,
  Home,
  Scale,
  GraduationCap,
  Bell,
  MapPin,
  Clock,
  Users,
  Edit,
  Trash2,
  Filter
} from "lucide-react";

interface CalendarEvent {
  id: string;
  title: string;
  type: "weighing" | "feeding" | "home_visit" | "training";
  date: string;
  time: string;
  location: string;
  purok?: string;
  assigned_to?: string;
  description?: string;
  reminder_sent: boolean;
}

export default function NutritionCalendarPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Add-event form state (inputs are controlled — previously they were
  // unbound, so submitted values were never captured).
  const emptyEventForm = {
    event_type: "weighing",
    title: "",
    event_date: "",
    time: "",
    location: "",
    purok_id: "",
    assigned_to: "",
    description: "",
    send_reminder: false,
  };
  const [eventForm, setEventForm] = useState(emptyEventForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Date.getMonth() is 0-indexed but SQL EXTRACT('month') is 1-indexed,
  // so the API must be sent getMonth() + 1 or events fall one month short.
  const queryMonth = currentDate.getMonth() + 1;

  const { data: events, isLoading } = useQuery({
    queryKey: ["calendar-events", queryMonth, currentDate.getFullYear()],
    queryFn: () =>
      api.get(`/api/calendar?month=${queryMonth}&year=${currentDate.getFullYear()}`).then((r) => r.data),
  });

  // Loaded only while the add-event modal is open.
  const puroksQuery = useQuery({
    queryKey: ["calendar-puroks", user?.role, user?.barangay_id],
    queryFn: () =>
      api
        .get(
          user?.role === "admin" && user?.barangay_id
            ? `/api/puroks?barangay_id=${user.barangay_id}`
            : "/api/puroks"
        )
        .then((r) => r.data),
    enabled: showForm,
  });

  const usersQuery = useQuery({
    queryKey: ["calendar-users"],
    queryFn: () => api.get("/api/users").then((r) => r.data),
    enabled: showForm,
  });

  const createEventMutation = useMutation({
    mutationFn: (payload: any) => api.post("/api/calendar", payload),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      setEventForm(emptyEventForm);
      setFormError(null);
      setShowForm(false);
      setSuccessMsg(`"${vars.title}" was added to the calendar`);
      // Jump to the event's own month so it is visible immediately.
      const [y, m] = String(vars.event_date).split("-").map(Number);
      setCurrentDate(new Date(y, m - 1, 1));
      setTimeout(() => setSuccessMsg(null), 4000);
    },
    onError: (err: any) => {
      const status = err?.response?.status;
      setFormError(
        status === 401
          ? "Session expired — please log in again."
          : status === 422
          ? "Some fields are missing or invalid."
          : "Could not save the event. Please try again."
      );
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: (eventId: string) => api.delete(`/api/calendar/${eventId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    },
  });

  function submitEvent(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!eventForm.title.trim() || !eventForm.event_date || !eventForm.time || !eventForm.location.trim()) {
      setFormError("Title, date, time and location are required.");
      return;
    }
    createEventMutation.mutate({
      title: eventForm.title.trim(),
      event_type: eventForm.event_type,
      event_date: eventForm.event_date,
      time: eventForm.time,
      location: eventForm.location.trim(),
      purok_id: eventForm.purok_id || null,
      assigned_to: eventForm.assigned_to || null,
      description: eventForm.description.trim() || null,
      send_reminder: eventForm.send_reminder,
    });
  }

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    return { daysInMonth, startingDayOfWeek };
  };

  const getEventsForDay = (day: number) => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events?.filter((e: CalendarEvent) => e.date === dateStr) || [];
  };

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case "weighing":
        return <Scale className="h-4 w-4" />;
      case "feeding":
        return <Target className="h-4 w-4" />;
      case "home_visit":
        return <Home className="h-4 w-4" />;
      case "training":
        return <GraduationCap className="h-4 w-4" />;
      default:
        return <Calendar className="h-4 w-4" />;
    }
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case "weighing":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "feeding":
        return "bg-green-100 text-green-700 border-green-200";
      case "home_visit":
        return "bg-purple-100 text-purple-700 border-purple-200";
      case "training":
        return "bg-orange-100 text-orange-700 border-orange-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentDate);
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const filteredEvents = events?.filter((e: CalendarEvent) => 
    typeFilter === "all" || e.type === typeFilter
  ) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Loading calendar...</div>
      </div>
    );
  }

  return (
    <div className="admin-container space-y-6">
      {/* Header */}
      <div className="admin-page-header flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Barangay Nutrition Calendar</h1>
          <p className="text-sm">Schedule and manage nutrition activities</p>
        </div>
        <button
          onClick={() => {
            setFormError(null);
            setShowForm(true);
          }}
          className="admin-action-btn-emerald flex items-center gap-2 px-4 py-2.5 text-xs text-white"
        >
          <Plus className="h-4 w-4" />
          Add Event
        </button>
      </div>

      {successMsg && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700" role="status">
          {successMsg}
        </div>
      )}

      {/* Calendar Navigation */}
      <div className="admin-glass-panel p-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={previousMonth}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="h-5 w-5 text-slate-600" />
          </button>
          <h2 className="text-lg font-semibold text-slate-900">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <button
            onClick={nextMonth}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ChevronRight className="h-5 w-5 text-slate-600" />
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="text-center text-xs font-semibold text-slate-500 py-2">
              {day}
            </div>
          ))}
          
          {/* Empty cells for days before the first day of the month */}
          {Array.from({ length: startingDayOfWeek }).map((_, index) => (
            <div key={`empty-${index}`} className="h-24 bg-slate-50 rounded-lg" />
          ))}
          
          {/* Days of the month */}
          {Array.from({ length: daysInMonth }).map((_, index) => {
            const day = index + 1;
            const dayEvents = getEventsForDay(day);
            const isToday = 
              day === new Date().getDate() && 
              currentDate.getMonth() === new Date().getMonth() && 
              currentDate.getFullYear() === new Date().getFullYear();

            return (
              <div
                key={day}
                className={`h-24 border border-slate-200 rounded-lg p-2 overflow-hidden cursor-pointer hover:bg-slate-50 transition-colors ${
                  isToday ? "bg-blue-50 border-blue-300" : "bg-white"
                }`}
              >
                <div className={`text-sm font-medium mb-1 ${isToday ? "text-blue-600" : "text-slate-900"}`}>
                  {day}
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 2).map((event: CalendarEvent) => (
                    <div
                      key={event.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEvent(event);
                      }}
                      className={`text-xs px-1.5 py-0.5 rounded truncate border ${getEventTypeColor(event.type)}`}
                    >
                      <span className="flex items-center gap-1">
                        {getEventTypeIcon(event.type)}
                        {event.title}
                      </span>
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <div className="text-xs text-slate-500">
                      +{dayEvents.length - 2} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming Events */}
      <div className="admin-glass-panel">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Upcoming Events</h3>
            <div className="flex items-center gap-3">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                <option value="weighing">Weighing Days</option>
                <option value="feeding">Feeding Programs</option>
                <option value="home_visit">Home Visits</option>
                <option value="training">Training Sessions</option>
              </select>
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-200">
          {filteredEvents.length === 0 ? (
            <div className="p-12 text-center">
              <Calendar className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm">No events scheduled for this month</p>
            </div>
          ) : (
            filteredEvents
              .sort((a: CalendarEvent, b: CalendarEvent) => new Date(a.date).getTime() - new Date(b.date).getTime())
              .map((event: CalendarEvent) => (
              <div
                key={event.id}
                className="p-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${getEventTypeColor(event.type)}`}>
                    {getEventTypeIcon(event.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedEvent(event)}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteEventMutation.mutate(event.id)}
                          className="text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(event.date).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {event.time}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {event.location}
                      </span>
                    </div>
                    {event.purok && (
                      <div className="text-xs text-slate-500 mt-1">
                        Purok: {event.purok}
                      </div>
                    )}
                    {event.assigned_to && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                        <Users className="h-3 w-3" />
                        {event.assigned_to}
                      </div>
                    )}
                    {event.reminder_sent && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-green-600">
                        <Bell className="h-3 w-3" />
                        Reminder sent
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Event Details</h2>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${getEventTypeColor(selectedEvent.type)}`}>
                {getEventTypeIcon(selectedEvent.type)}
                <span className="text-sm font-medium capitalize">{selectedEvent.type.replace("_", " ")}</span>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-slate-900">{selectedEvent.title}</h3>
                {selectedEvent.description && (
                  <p className="text-sm text-slate-600 mt-2">{selectedEvent.description}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 uppercase">Date</p>
                  <p className="text-sm font-medium text-slate-900">{new Date(selectedEvent.date).toLocaleDateString()}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 uppercase">Time</p>
                  <p className="text-sm font-medium text-slate-900">{selectedEvent.time}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 uppercase">Location</p>
                  <p className="text-sm font-medium text-slate-900">{selectedEvent.location}</p>
                </div>
                {selectedEvent.purok && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500 uppercase">Purok</p>
                    <p className="text-sm font-medium text-slate-900">{selectedEvent.purok}</p>
                  </div>
                )}
              </div>

              {selectedEvent.assigned_to && (
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 uppercase">Assigned To</p>
                  <p className="text-sm font-medium text-slate-900">{selectedEvent.assigned_to}</p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                  Edit Event
                </button>
                <button
                  onClick={() => deleteEventMutation.mutate(selectedEvent.id)}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
                >
                  Delete Event
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Event Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Add New Event</h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <form onSubmit={submitEvent} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Event Type</label>
                <select
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={eventForm.event_type}
                  onChange={(e) => setEventForm({ ...eventForm, event_type: e.target.value })}
                >
                  <option value="weighing">Weighing Day</option>
                  <option value="feeding">Feeding Program</option>
                  <option value="home_visit">Home Visit</option>
                  <option value="training">Training Session</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Event title..."
                  value={eventForm.title}
                  onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={eventForm.event_date}
                    onChange={(e) => setEventForm({ ...eventForm, event_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Time</label>
                  <input
                    type="time"
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={eventForm.time}
                    onChange={(e) => setEventForm({ ...eventForm, time: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Location..."
                  value={eventForm.location}
                  onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Purok (Optional)</label>
                <select
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={eventForm.purok_id}
                  onChange={(e) => setEventForm({ ...eventForm, purok_id: e.target.value })}
                >
                  <option value="">Select purok...</option>
                  {(puroksQuery.data || []).map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.barangay_name ? ` — ${p.barangay_name}` : ""}
                    </option>
                  ))}
                </select>
                {puroksQuery.isLoading && (
                  <p className="text-xs text-slate-400 mt-1">Loading puroks...</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Assign To (Optional)</label>
                <select
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={eventForm.assigned_to}
                  onChange={(e) => setEventForm({ ...eventForm, assigned_to: e.target.value })}
                >
                  <option value="">Select user...</option>
                  {(usersQuery.data || []).map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.username}
                    </option>
                  ))}
                </select>
                {usersQuery.isLoading && <p className="text-xs text-slate-400 mt-1">Loading users...</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Event details..."
                  value={eventForm.description}
                  onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="reminder"
                  className="rounded border-slate-300"
                  checked={eventForm.send_reminder}
                  onChange={(e) => setEventForm({ ...eventForm, send_reminder: e.target.checked })}
                />
                <label htmlFor="reminder" className="text-sm text-slate-700">Send reminder notification</label>
              </div>

              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600" role="alert">
                  {formError}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createEventMutation.isPending}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                >
                  {createEventMutation.isPending && (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  )}
                  {createEventMutation.isPending ? "Saving..." : "Add Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
