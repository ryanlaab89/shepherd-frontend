import { gql } from '@apollo/client'

export const CHECK_IN_MUTATION = gql`
  mutation CheckIn($personId: ID!, $serviceId: ID!, $guardianName: String, $guardianPhone: String) {
    checkIn(personId: $personId, serviceId: $serviceId, guardianName: $guardianName, guardianPhone: $guardianPhone) {
      id
      pickup_code
      guardian_name
      guardian_phone
      checked_in_at
      person {
        id
        first_name
        last_name
      }
      service {
        id
        name
      }
    }
  }
`

export const CHECK_OUT_MUTATION = gql`
  mutation CheckOut($checkinId: ID!) {
    checkOut(checkinId: $checkinId) {
      id
      pickup_code
      checked_out_at
      person {
        first_name
        last_name
      }
    }
  }
`

export const REGISTER_CHILD_MUTATION = gql`
  mutation RegisterChild($input: RegisterChildInput!) {
    registerChild(input: $input) {
      id
      first_name
      last_name
      date_of_birth
      medical_notes
      classGroup { id name }
      household { id last_name phone }
      activeCheckin { id pickup_code service { name } }
    }
  }
`

export const ADD_CHILD_MUTATION = gql`
  mutation AddChildToHousehold($householdId: ID!, $input: ChildInput!) {
    addChildToHousehold(householdId: $householdId, input: $input) {
      id
      first_name
      last_name
      date_of_birth
      medical_notes
      household {
        id
        last_name
        phone
      }
      activeCheckin {
        id
        pickup_code
        service { name }
      }
    }
  }
`

export const CHECK_OUT_BY_CODE_MUTATION = gql`
  mutation CheckOutByCode($code: String!) {
    checkOutByCode(code: $code) {
      id
      pickup_code
      checked_out_at
      person {
        first_name
        last_name
      }
    }
  }
`

export const CREATE_USER_MUTATION = gql`
  mutation CreateUser($input: CreateUserInput!) {
    createUser(input: $input) {
      id
      name
      email
      role
      created_at
    }
  }
`

export const UPDATE_USER_ROLE_MUTATION = gql`
  mutation UpdateUserRole($userId: ID!, $role: String!) {
    updateUserRole(userId: $userId, role: $role) {
      id
      role
    }
  }
`

export const DELETE_USER_MUTATION = gql`
  mutation DeleteUser($userId: ID!) {
    deleteUser(userId: $userId)
  }
`

export const UPDATE_USER_MUTATION = gql`
  mutation UpdateUser($userId: ID!, $input: UpdateUserInput!) {
    updateUser(userId: $userId, input: $input) {
      id
      name
      email
    }
  }
`

export const RESET_PASSWORD_MUTATION = gql`
  mutation ResetUserPassword($userId: ID!, $password: String!) {
    resetUserPassword(userId: $userId, password: $password) {
      id
    }
  }
`

export const SET_USER_ACTIVE_MUTATION = gql`
  mutation SetUserActive($userId: ID!, $active: Boolean!) {
    setUserActive(userId: $userId, active: $active) {
      id
      is_active
    }
  }
`

export const UPDATE_PERSON_MUTATION = gql`
  mutation UpdatePerson($personId: ID!, $input: UpdatePersonInput!) {
    updatePerson(personId: $personId, input: $input) {
      id
      first_name
      last_name
      date_of_birth
      medical_notes
      classGroup { id name }
    }
  }
`

export const CREATE_SERVICE_MUTATION = gql`
  mutation CreateService($input: ServiceInput!) {
    createService(input: $input) {
      id
      name
      day_of_week
      start_time
      end_time
    }
  }
`

export const UPDATE_SERVICE_MUTATION = gql`
  mutation UpdateService($id: ID!, $input: ServiceInput!) {
    updateService(id: $id, input: $input) {
      id
      name
      day_of_week
      start_time
      end_time
    }
  }
`

export const DELETE_SERVICE_MUTATION = gql`
  mutation DeleteService($id: ID!) {
    deleteService(id: $id)
  }
`

const CLASS_FIELDS = gql`
  fragment ClassFields on ClassGroup {
    id name min_age max_age description
    people { id first_name last_name }
  }
`

export const CREATE_CLASS_MUTATION = gql`
  ${CLASS_FIELDS}
  mutation CreateClass($input: ClassInput!) {
    createClass(input: $input) { ...ClassFields }
  }
`

export const UPDATE_CLASS_MUTATION = gql`
  ${CLASS_FIELDS}
  mutation UpdateClass($id: ID!, $input: ClassInput!) {
    updateClass(id: $id, input: $input) { ...ClassFields }
  }
`

export const DELETE_CLASS_MUTATION = gql`
  mutation DeleteClass($id: ID!) {
    deleteClass(id: $id)
  }
`

export const ASSIGN_CHILD_TO_CLASS_MUTATION = gql`
  mutation AssignChildToClass($personId: ID!, $classId: ID) {
    assignChildToClass(personId: $personId, classId: $classId) {
      id first_name last_name
      classGroup { id name }
    }
  }
`

export const SET_CLASS_SESSION_MUTATION = gql`
  mutation SetClassSession($classId: ID!, $teacherName: String!, $teacherPhone: String) {
    setClassSession(classId: $classId, teacherName: $teacherName, teacherPhone: $teacherPhone) {
      id teacher_name teacher_phone session_date
    }
  }
`

export const UPDATE_CHURCH_SETTINGS_MUTATION = gql`
  mutation UpdateChurchSettings($input: ChurchSettingsInput!) {
    updateChurchSettings(input: $input) {
      require_checkout
      show_checkout
    }
  }
`

export const UPDATE_PROFILE_MUTATION = gql`
  mutation UpdateProfile($input: UpdateProfileInput!) {
    updateProfile(input: $input) {
      id
      name
      email
      phone
      role
    }
  }
`
