import { gql } from '@apollo/client'

export const ME_QUERY = gql`
  query Me {
    me {
      id
      name
      email
      phone
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
      person { id first_name last_name }
      service { id name }
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

export const CHURCH_SETTINGS_QUERY = gql`
  query ChurchSettings {
    churchSettings {
      require_checkout
      show_checkout
    }
  }
`
