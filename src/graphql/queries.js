import { gql } from '@apollo/client'

export const ME_QUERY = gql`
  query Me {
    me {
      id
      name
      email
      phone
      photo
      role
      church {
        id
        name
      }
    }
  }
`

export const SERVICES_QUERY = gql`
  query Services {
    services {
      id
      name
      day_of_week
      start_time
      end_time
    }
  }
`

export const USERS_QUERY = gql`
  query Users {
    users {
      id
      name
      email
      phone
      role
      is_active
      created_at
    }
  }
`

export const CLASSES_QUERY = gql`
  query Classes {
    classes {
      id
      name
      min_age
      max_age
      description
      people { id first_name last_name }
    }
  }
`

export const PERSON_GUARDIANS_QUERY = gql`
  query PersonGuardians($personId: ID!) {
    personGuardians(personId: $personId) {
      guardian_name
      guardian_phone
    }
  }
`

export const TODAY_CLASS_SESSIONS_QUERY = gql`
  query TodayClassSessions {
    todayClassSessions {
      id
      name
      todaySession {
        id
        teacher_name
        teacher_phone
      }
    }
  }
`

export const ATTENDANCE_REPORT_QUERY = gql`
  query AttendanceReport($startDate: Date!, $endDate: Date!) {
    attendanceReport(startDate: $startDate, endDate: $endDate) {
      total
      avg_per_day
      by_day { date count }
      by_class { class_name count }
      by_service { service_name count }
    }
  }
`

export const GUARDIAN_CONTACTS_QUERY = gql`
  query GuardianContacts($startDate: Date!, $endDate: Date!) {
    guardianContacts(startDate: $startDate, endDate: $endDate) {
      child_name
      class_name
      guardian_name
      guardian_phone
      last_visit
      visit_count
    }
  }
`

export const SEARCH_CHILDREN_QUERY = gql`
  query SearchChildren($query: String!) {
    searchChildren(query: $query) {
      id
      first_name
      last_name
      date_of_birth
      medical_notes
      classGroup { id name }
      household {
        id
        last_name
        phone
      }
      activeCheckin {
        id
        service { name }
      }
    }
  }
`

export const SEARCH_HOUSEHOLDS_QUERY = gql`
  query SearchHouseholds($query: String!) {
    searchHouseholds(query: $query) {
      id
      last_name
      phone
      email
      people {
        id
        first_name
        last_name
        date_of_birth
        medical_notes
        activeCheckin {
          id
          pickup_code
          service {
            name
          }
        }
      }
    }
  }
`

export const ACTIVE_CHECKINS_QUERY = gql`
  query ActiveCheckins {
    activeCheckins {
      id
      pickup_code
      guardian_name
      guardian_phone
      checked_in_at
      classGroup { id name }
      person { id first_name last_name }
      service { id name }
    }
  }
`

export const TODAY_CHECKINS_QUERY = gql`
  query TodayCheckins {
    todayCheckins {
      id
      pickup_code
      guardian_name
      guardian_phone
      checked_in_at
      checked_out_at
      classGroup { id name }
      service { id name }
      person {
        id
        first_name
        last_name
        date_of_birth
        medical_notes
        checkins_count
        last_checkin_at
        household { id last_name phone }
      }
    }
  }
`

export const CHECKIN_BY_CODE_QUERY = gql`
  query CheckinByCode($code: String!) {
    checkinByCode(code: $code) {
      id
      pickup_code
      checked_in_at
      person {
        id
        first_name
        last_name
        medical_notes
      }
      service {
        id
        name
      }
    }
  }
`

export const DASHBOARD_QUERY = gql`
  query Dashboard {
    dashboard {
      total_today
      currently_checked_in
      by_service {
        service_name
        count
      }
    }
  }
`

export const CHILDREN_QUERY = gql`
  query Children {
    children {
      id
      first_name
      last_name
      date_of_birth
      medical_notes
      notes
      checkins_count
      last_checkin_at
      household { id last_name phone }
      classGroup { id name }
    }
  }
`

export const CHILD_CHECKINS_QUERY = gql`
  query ChildCheckins($personId: ID!) {
    childCheckins(personId: $personId) {
      id
      checked_in_at
      checked_out_at
      teacher_name
      teacher_phone
      service { name }
      classGroup { name }
    }
  }
`

export const ATTENDANCE_LOGS_QUERY = gql`
  query AttendanceLogs($date: Date, $serviceId: ID, $classId: ID) {
    attendanceLogs(date: $date, serviceId: $serviceId, classId: $classId) {
      id
      pickup_code
      guardian_name
      guardian_phone
      checked_in_at
      checked_out_at
      person { id first_name last_name date_of_birth medical_notes }
      service { id name }
      classGroup { id name }
    }
  }
`

export const CHURCH_SETTINGS_QUERY = gql`
  query ChurchSettings {
    churchSettings {
      require_checkout
      show_checkout
    }
  }
`

export const SCHEDULES_QUERY = gql`
  query Schedules($date: Date!) {
    schedules(date: $date) {
      id
      date
      is_lead
      user { id name role }
      classGroup { id name }
      service { id name start_time }
    }
  }
`

export const MY_SCHEDULE_QUERY = gql`
  query MySchedule {
    mySchedule {
      id
      date
      is_lead
      classGroup { id name }
      service { id name start_time }
    }
  }
`

export const ASSIGN_TEACHER_MUTATION = gql`
  mutation AssignTeacher($classId: ID!, $serviceId: ID!, $userId: ID!, $date: Date!, $isLead: Boolean) {
    assignTeacher(classId: $classId, serviceId: $serviceId, userId: $userId, date: $date, isLead: $isLead) {
      id
      is_lead
      user { id name }
      classGroup { id name }
      service { id name start_time }
    }
  }
`

export const REMOVE_TEACHER_MUTATION = gql`
  mutation RemoveTeacher($scheduleId: ID!) {
    removeTeacher(scheduleId: $scheduleId)
  }
`

export const SET_LEAD_MUTATION = gql`
  mutation SetLead($scheduleId: ID!) {
    setLead(scheduleId: $scheduleId) {
      id
      is_lead
    }
  }
`
