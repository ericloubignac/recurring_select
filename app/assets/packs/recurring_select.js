import $ from 'jquery'

import('../stylesheets/recurring_select.scss')

$(function () {
  $(document).on('focus', '.recurring_select', function () {
    return $(this).recurring_select('set_initial_values')
  })

  return $(document).on('change', '.recurring_select', function () {
    return $(this).recurring_select('changed')
  })
})

const methods = {
  set_initial_values () {
    this.data('initial-value-hash', this.val())
    return this.data('initial-value-str', $(this.find('option').get()[this.prop('selectedIndex')]).text())
  },

  changed () {
    if (this.val() === 'custom') {
      return methods.open_custom.apply(this)
    } else {
      return methods.set_initial_values.apply(this)
    }
  },

  open_custom () {
    this.data('recurring-select-active', true)
    this.blur()
    return new RecurringSelectDialog(this)
  },

  save (newRule) {
    this.find('option[data-custom]').remove()
    const newJsonVal = JSON.stringify(newRule.hash)

    // TODO: check for matching name, and replace that value if found

    if ($.inArray(newJsonVal, this.find('option').map(function () { return $(this).val() })) === -1) {
      methods.insert_option.apply(this, [newRule.str, newJsonVal])
    }

    this.val(newJsonVal)
    methods.set_initial_values.apply(this)
    return this.trigger('recurring_select:save')
  },

  current_rule () {
    return {
      str: this.data('initial-value-str'),
      hash: $.parseJSON(this.data('initial-value-hash'))
    }
  },

  cancel () {
    this.val(this.data('initial-value-hash'))
    this.data('recurring-select-active', false)
    return this.trigger('recurring_select:cancel')
  },

  insert_option (newRuleStr, newRuleJson) {
    let separator = this.find('option:disabled')
    if (separator.length === 0) {
      separator = this.find('option')
    }
    separator = separator.last()

    const newOption = $(document.createElement('option'))
    newOption.attr('data-custom', true)

    if (newRuleStr.substr(newRuleStr.length - 1) !== '*') {
      newRuleStr += '*'
    }

    newOption.text(newRuleStr)
    newOption.val(newRuleJson)
    return newOption.insertBefore(separator)
  },

  methods () {
    return methods
  }
}

$.fn.recurring_select = function (method) {
  if (method in methods) {
    return methods[method].apply(this, Array.prototype.slice.call(arguments, 1))
  } else {
    return $.error(`Method ${method} does not exist on jQuery.recurring_select`)
  }
}

$.fn.recurring_select.options = {
  monthly: {
    show_week: [true, true, true, true, false, false]
  }
}

const enTexts = {
  locale_iso_code: 'en',
  repeat: 'Repeat',
  last_day: 'Last Day',
  frequency: 'Frequency',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
  every: 'Every',
  days: 'day(s)',
  weeks_on: 'week(s) on',
  months: 'month(s)',
  years: 'year(s)',
  day_of_month: 'Day of month',
  day_of_week: 'Day of week',
  cancel: 'Cancel',
  ok: 'OK',
  summary: 'Summary',
  first_day_of_week: 0,
  days_first_letter: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
  order: ['1st', '2nd', '3rd', '4th', '5th', 'Last'],
  show_week: [true, true, true, true, false, false]
}

const frTexts = {
  locale_iso_code: 'fr',
  repeat: 'Récurrence',
  last_day: 'Dernier jour',
  frequency: 'Fréquence',
  daily: 'Tous les jours',
  weekly: 'Toutes les semaines',
  monthly: 'Tous les mois',
  yearly: 'Tous les ans',
  every: 'Tous les',
  days: 'jour(s)',
  weeks_on: 'semaine(s) le',
  months: 'mois',
  years: 'année(s)',
  day_of_month: 'Jour du mois',
  day_of_week: 'Jour de la semaine',
  ok: 'OK',
  cancel: 'Annuler',
  summary: 'Résumé',
  first_day_of_week: 1,
  days_first_letter: ['D', 'L', 'M', 'M', 'J', 'V', 'S'],
  order: ['1er', '2ème', '3ème', '4ème', '5ème', 'Dernier'],
  show_week: [true, true, true, true, false, false]
}

$.fn.recurring_select.texts = document.documentElement.lang === 'fr' ? frTexts : enTexts

let RecurringSelectDialog
window.RecurringSelectDialog =
  (RecurringSelectDialog = class RecurringSelectDialog {
    constructor (recurringSelector) {
      this.positionDialogVert = this.positionDialogVert.bind(this)
      this.cancel = this.cancel.bind(this)
      this.outerCancel = this.outerCancel.bind(this)
      this.save = this.save.bind(this)
      this.summaryUpdate = this.summaryUpdate.bind(this)
      this.summaryFetchSuccess = this.summaryFetchSuccess.bind(this)
      this.init_calendar_days = this.init_calendar_days.bind(this)
      this.init_calendar_weeks = this.init_calendar_weeks.bind(this)
      this.toggle_month_view = this.toggle_month_view.bind(this)
      this.freqChanged = this.freqChanged.bind(this)
      this.intervalChanged = this.intervalChanged.bind(this)
      this.daysChanged = this.daysChanged.bind(this)
      this.dateOfMonthChanged = this.dateOfMonthChanged.bind(this)
      this.weekOfMonthChanged = this.weekOfMonthChanged.bind(this)
      this.recurringSelector = recurringSelector
      this.current_rule = this.recurringSelector.recurring_select('current_rule')
      this.initDialogBox()
      if ((this.current_rule.hash == null) || (this.current_rule.hash.rule_type == null)) {
        this.freqChanged()
      } else {
        setTimeout(this.positionDialogVert, 10) // allow initial render
      }
    }

    initDialogBox () {
      $('.rs_dialog_holder').remove()

      let openIn = $('body')
      if ($('.ui-page-active').length) { openIn = $('.ui-page-active') }
      openIn.append(this.template())
      this.outer_holder = $('.rs_dialog_holder')
      this.inner_holder = this.outer_holder.find('.rs_dialog')
      this.content = this.outer_holder.find('.rs_dialog_content')
      this.positionDialogVert(true)
      this.mainEventInit()
      this.freqInit()
      this.summaryInit()
      this.outer_holder.trigger('recurring_select:dialog_opened')
      return this.freq_select.focus()
    }

    positionDialogVert (initialPositioning) {
      const windowHeight = $(window).height()
      let dialogHeight = this.content.outerHeight()
      if (dialogHeight < 80) {
        dialogHeight = 80
      }
      let marginTop = ((windowHeight - dialogHeight) / 2) - 30
      if (marginTop < 10) { marginTop = 10 }
      // if dialogHeight > windowHeight - 20
      //   dialogHeight = windowHeight - 20

      const newStyleHash = {
        'margin-top': marginTop + 'px',
        'min-height': dialogHeight + 'px'
      }

      if (initialPositioning != null) {
        this.inner_holder.css(newStyleHash)
        return this.inner_holder.trigger('recurring_select:dialog_positioned')
      } else {
        this.inner_holder.addClass('animated')
        return this.inner_holder.animate(newStyleHash, 200, () => {
          this.inner_holder.removeClass('animated')
          this.content.css({ width: 'auto' })
          return this.inner_holder.trigger('recurring_select:dialog_positioned')
        })
      }
    }

    cancel () {
      this.outer_holder.remove()
      return this.recurringSelector.recurring_select('cancel')
    }

    outerCancel (event) {
      if ($(event.target).hasClass('rs_dialog_holder')) {
        return this.cancel()
      }
    }

    save () {
      if ((this.current_rule.str == null)) { return }
      this.outer_holder.remove()
      return this.recurringSelector.recurring_select('save', this.current_rule)
    }

    // ========================= Init Methods ===============================

    mainEventInit () {
      // Tap hooks are for jQueryMobile
      this.outer_holder.on('click tap', this.outerCancel)
      this.content.on('click tap', 'h1 a', this.cancel)
      this.save_button = this.content.find('input.rs_save').on('click tap', this.save)
      return this.content.find('input.rs_cancel').on('click tap', this.cancel)
    }

    freqInit () {
      let ruleType
      this.freq_select = this.outer_holder.find('.rs_frequency')
      if ((this.current_rule.hash != null) && ((ruleType = this.current_rule.hash.rule_type) != null)) {
        if (ruleType.search(/Weekly/) !== -1) {
          this.freq_select.prop('selectedIndex', 1)
          this.initWeeklyOptions()
        } else if (ruleType.search(/Monthly/) !== -1) {
          this.freq_select.prop('selectedIndex', 2)
          this.initMonthlyOptions()
        } else if (ruleType.search(/Yearly/) !== -1) {
          this.freq_select.prop('selectedIndex', 3)
          this.initYearlyOptions()
        } else {
          this.initDailyOptions()
        }
      }
      return this.freq_select.on('change', this.freqChanged)
    }

    initDailyOptions () {
      const section = this.content.find('.daily_options')
      const intervalInput = section.find('.rs_daily_interval')
      intervalInput.val(this.current_rule.hash.interval)
      intervalInput.on('change keyup', this.intervalChanged)
      return section.show()
    }

    initWeeklyOptions () {
      const section = this.content.find('.weekly_options')

      // connect the interval field
      const intervalInput = section.find('.rs_weekly_interval')
      intervalInput.val(this.current_rule.hash.interval)
      intervalInput.on('change keyup', this.intervalChanged)

      // clear selected days
      section.find('.day_holder a').each((index, element) => $(element).removeClass('selected'))

      // connect the day fields
      if ((this.current_rule.hash.validations != null) && (this.current_rule.hash.validations.day != null)) {
        $(this.current_rule.hash.validations.day).each((index, val) => {
          section.find(`.day_holder a[data-value='${val}']`).addClass('selected')
        })
      }

      section.off('click', '.day_holder a').on('click', '.day_holder a', this.daysChanged)

      return section.show()
    }

    initMonthlyOptions () {
      const section = this.content.find('.monthly_options')
      const intervalInput = section.find('.rs_monthly_interval')
      intervalInput.val(this.current_rule.hash.interval)
      intervalInput.on('change keyup', this.intervalChanged)

      if (!this.current_rule.hash.validations) { this.current_rule.hash.validations = {} }
      if (!this.current_rule.hash.validations.day_of_month) { this.current_rule.hash.validations.day_of_month = [] }
      if (!this.current_rule.hash.validations.day_of_week) { this.current_rule.hash.validations.day_of_week = {} }
      this.init_calendar_days(section)
      this.init_calendar_weeks(section)

      const inWeekMode = Object.keys(this.current_rule.hash.validations.day_of_week).length > 0
      section.find('.monthly_rule_type_week').prop('checked', inWeekMode)
      section.find('.monthly_rule_type_day').prop('checked', !inWeekMode)
      this.toggle_month_view()
      section.find('input[name=monthly_rule_type]').on('change', this.toggle_month_view)
      return section.show()
    }

    initYearlyOptions () {
      const section = this.content.find('.yearly_options')
      const intervalInput = section.find('.rs_yearly_interval')
      intervalInput.val(this.current_rule.hash.interval)
      intervalInput.on('change keyup', this.intervalChanged)
      return section.show()
    }

    summaryInit () {
      this.summary = this.outer_holder.find('.rs_summary')
      return this.summaryUpdate()
    }

    // ========================= render methods ===============================

    summaryUpdate (newString) {
      this.summary.width(this.content.width())
      if ((this.current_rule.hash != null) && (this.current_rule.str != null)) {
        this.summary.removeClass('fetching')
        this.save_button.removeClass('disabled')
        let ruleStr = this.current_rule.str.replace('*', '')
        if (ruleStr.length < 20) {
          ruleStr = `${$.fn.recurring_select.texts.summary}: ` + ruleStr
        }
        return this.summary.find('span').html(ruleStr)
      } else {
        this.summary.addClass('fetching')
        this.save_button.addClass('disabled')
        this.summary.find('span').html('')
        return this.summaryFetch()
      }
    }

    summaryFetch () {
      if (!((this.current_rule.hash != null) && ((this.current_rule.hash.rule_type) != null))) { return }
      this.current_rule.hash.week_start = $.fn.recurring_select.texts.first_day_of_week
      this.summaryFetchSuccess('Custom')
    }

    summaryFetchSuccess (data) {
      this.current_rule.str = data
      this.summaryUpdate()
      return this.content.css({ width: 'auto' })
    }

    init_calendar_days (section) {
      const monthlyCalendar = section.find('.rs_calendar_day')
      monthlyCalendar.html('')
      for (let num = 1; num <= 31; num++) {
        const dayLink = $(document.createElement('a')).text(num)
        monthlyCalendar.append((dayLink))
        if ($.inArray(num, this.current_rule.hash.validations.day_of_month) !== -1) {
          dayLink.addClass('selected')
        }
      }

      // add last day of month button
      const endOfMonthLink = $(document.createElement('a')).text($.fn.recurring_select.texts.last_day)
      monthlyCalendar.append((endOfMonthLink))
      endOfMonthLink.addClass('end_of_month')
      if ($.inArray(-1, this.current_rule.hash.validations.day_of_month) !== -1) {
        endOfMonthLink.addClass('selected')
      }

      return monthlyCalendar.find('a').on('click tap', this.dateOfMonthChanged)
    }

    init_calendar_weeks (section) {
      let dayOfWeek
      const monthlyCalendar = section.find('.rs_calendar_week')
      monthlyCalendar.html('')
      const rowLabels = $.fn.recurring_select.texts.order
      const showRow = $.fn.recurring_select.options.monthly.show_week
      const cellStr = $.fn.recurring_select.texts.days_first_letter

      const iterable = [1, 2, 3, 4, 5, -1]
      for (let index = 0; index < iterable.length; index++) {
        const num = iterable[index]
        if (showRow[index]) {
          let start = $.fn.recurring_select.texts.first_day_of_week
          const end = 7 + $.fn.recurring_select.texts.first_day_of_week
          const asc = $.fn.recurring_select.texts.first_day_of_week <= end
          monthlyCalendar.append(`<span>${rowLabels[num - 1]}</span>`)
          for (dayOfWeek = start; asc ? start < end : start > end; asc ? start++ : start--, dayOfWeek = start) {
            dayOfWeek = dayOfWeek % 7
            const dayLink = $('<a>', { text: cellStr[dayOfWeek] })
            dayLink.attr('day', dayOfWeek)
            dayLink.attr('instance', num)
            monthlyCalendar.append(dayLink)
          }
        }
      }

      $.each(this.current_rule.hash.validations.day_of_week, (key, value) =>
        $.each(value, (index, instance) => section.find(`a[day='${key}'][instance='${instance}']`).addClass('selected'))
      )
      return monthlyCalendar.find('a').on('click tap', this.weekOfMonthChanged)
    }

    toggle_month_view () {
      const weekMode = this.content.find('.monthly_rule_type_week').prop('checked')
      this.content.find('.rs_calendar_week').toggle(weekMode)
      return this.content.find('.rs_calendar_day').toggle(!weekMode)
    }

    // ========================= Change callbacks ===============================

    freqChanged () {
      if (!$.isPlainObject(this.current_rule.hash)) { this.current_rule.hash = null } // for custom values

      if (!this.current_rule.hash) { this.current_rule.hash = {} }
      this.current_rule.hash.interval = 1
      this.current_rule.hash.until = null
      this.current_rule.hash.count = null
      this.current_rule.hash.validations = null
      this.content.find('.freq_option_section').hide()
      this.content.find('input[type=radio], input[type=checkbox]').prop('checked', false)
      switch (this.freq_select.val()) {
        case 'Weekly':
          this.current_rule.hash.rule_type = 'IceCube::WeeklyRule'
          this.current_rule.str = $.fn.recurring_select.texts.weekly
          this.initWeeklyOptions()
          break
        case 'Monthly':
          this.current_rule.hash.rule_type = 'IceCube::MonthlyRule'
          this.current_rule.str = $.fn.recurring_select.texts.monthly
          this.initMonthlyOptions()
          break
        case 'Yearly':
          this.current_rule.hash.rule_type = 'IceCube::YearlyRule'
          this.current_rule.str = $.fn.recurring_select.texts.yearly
          this.initYearlyOptions()
          break
        default:
          this.current_rule.hash.rule_type = 'IceCube::DailyRule'
          this.current_rule.str = $.fn.recurring_select.texts.daily
          this.initDailyOptions()
      }
      this.summaryUpdate()
      return this.positionDialogVert()
    }

    intervalChanged (event) {
      this.current_rule.str = null
      if (!this.current_rule.hash) { this.current_rule.hash = {} }
      this.current_rule.hash.interval = parseInt($(event.currentTarget).val())
      if ((this.current_rule.hash.interval < 1) || isNaN(this.current_rule.hash.interval)) {
        this.current_rule.hash.interval = 1
      }
      return this.summaryUpdate()
    }

    daysChanged (event) {
      $(event.currentTarget).toggleClass('selected')
      this.current_rule.str = null
      if (!this.current_rule.hash) { this.current_rule.hash = {} }
      this.current_rule.hash.validations = {}
      const rawDays = this.content.find('.day_holder a.selected').map(function () {
        return parseInt($(this).data('value'))
      })
      this.current_rule.hash.validations.day = rawDays.get()
      this.summaryUpdate()
      return false // this prevents default and propogation
    }

    dateOfMonthChanged (event) {
      $(event.currentTarget).toggleClass('selected')
      this.current_rule.str = null
      if (!this.current_rule.hash) { this.current_rule.hash = {} }
      this.current_rule.hash.validations = {}
      const rawDays = this.content.find('.monthly_options .rs_calendar_day a.selected').map(function () {
        const res = $(this).text() === $.fn.recurring_select.texts.last_day ? -1 : parseInt($(this).text())
        return res
      })
      this.current_rule.hash.validations.day_of_week = {}
      this.current_rule.hash.validations.day_of_month = rawDays.get()
      this.summaryUpdate()
      return false
    }

    weekOfMonthChanged (event) {
      $(event.currentTarget).toggleClass('selected')
      this.current_rule.str = null
      if (!this.current_rule.hash) { this.current_rule.hash = {} }
      this.current_rule.hash.validations = {}
      this.current_rule.hash.validations.day_of_month = []
      this.current_rule.hash.validations.day_of_week = {}
      this.content.find('.monthly_options .rs_calendar_week a.selected').each((index, elm) => {
        const day = parseInt($(elm).attr('day'))
        const instance = parseInt($(elm).attr('instance'))
        if (!this.current_rule.hash.validations.day_of_week[day]) {
          this.current_rule.hash.validations.day_of_week[day] = []
        }
        return this.current_rule.hash.validations.day_of_week[day].push(instance)
      })
      this.summaryUpdate()
      return false
    }

    // ========================= Change callbacks ===============================

    template () {
      let str = `\
<div class='rs_dialog_holder'> \
<div class='rs_dialog'> \
<div class='rs_dialog_content'> \
<h1>${$.fn.recurring_select.texts.repeat} <a href='#' title='${$.fn.recurring_select.texts.cancel}' Alt='${$.fn.recurring_select.texts.cancel}'></a> </h1> \
<p class='frequency-select-wrapper'> \
<label for='rs_frequency'>${$.fn.recurring_select.texts.frequency}:</label> \
<select data-wrapper-class='ui-recurring-select' id='rs_frequency' class='rs_frequency' name='rs_frequency'> \
<option value='Daily'>${$.fn.recurring_select.texts.daily}</option> \
<option value='Weekly'>${$.fn.recurring_select.texts.weekly}</option> \
<option value='Monthly'>${$.fn.recurring_select.texts.monthly}</option> \
<option value='Yearly'>${$.fn.recurring_select.texts.yearly}</option> \
</select> \
</p> \
\
<div class='daily_options freq_option_section'> \
<p> \
${$.fn.recurring_select.texts.every} \
<input type='text' data-wrapper-class='ui-recurring-select' name='rs_daily_interval' class='rs_daily_interval rs_interval' value='1' size='2' /> \
${$.fn.recurring_select.texts.days} \
</p> \
</div> \
<div class='weekly_options freq_option_section'> \
<p> \
${$.fn.recurring_select.texts.every} \
<input type='text' data-wrapper-class='ui-recurring-select' name='rs_weekly_interval' class='rs_weekly_interval rs_interval' value='1' size='2' /> \
${$.fn.recurring_select.texts.weeks_on}: \
</p> \
<div class='day_holder'>\
`
      for (let i = $.fn.recurring_select.texts.first_day_of_week, dayOfWeek = i, end = 7 + $.fn.recurring_select.texts.first_day_of_week, asc = $.fn.recurring_select.texts.first_day_of_week <= end; asc ? i < end : i > end; asc ? i++ : i--, dayOfWeek = i) {
        dayOfWeek = dayOfWeek % 7
        str += `<a href='#' data-value='${dayOfWeek}'>${$.fn.recurring_select.texts.days_first_letter[dayOfWeek]}</a>`
      }

      str += `\
</div> \
<span style='clear:both; visibility:hidden; height:1px;'>.</span> \
</div> \
<div class='monthly_options freq_option_section'> \
<p> \
${$.fn.recurring_select.texts.every} \
<input type='text' data-wrapper-class='ui-recurring-select' name='rs_monthly_interval' class='rs_monthly_interval rs_interval' value='1' size='2' /> \
${$.fn.recurring_select.texts.months}: \
</p> \
<p class='monthly_rule_type'> \
<span><label for='monthly_rule_type_day'>${$.fn.recurring_select.texts.day_of_month}</label><input type='radio' class='monthly_rule_type_day' name='monthly_rule_type' id='monthly_rule_type_day' value='true' /></span> \
<span><label for='monthly_rule_type_week'>${$.fn.recurring_select.texts.day_of_week}</label><input type='radio' class='monthly_rule_type_week' name='monthly_rule_type' id='monthly_rule_type_week' value='true' /></span> \
</p> \
<p class='rs_calendar_day'></p> \
<p class='rs_calendar_week'></p> \
</div> \
<div class='yearly_options freq_option_section'> \
<p> \
${$.fn.recurring_select.texts.every} \
<input type='text' data-wrapper-class='ui-recurring-select' name='rs_yearly_interval' class='rs_yearly_interval rs_interval' value='1' size='2' /> \
${$.fn.recurring_select.texts.years} \
</p> \
</div> \
<p class='rs_summary'> \
<span></span> \
</p> \
<div class='controls'> \
<input type='button' data-wrapper-class='ui-recurring-select' class='rs_save' value='${$.fn.recurring_select.texts.ok}' /> \
<input type='button' data-wrapper-class='ui-recurring-select' class='rs_cancel' value='${$.fn.recurring_select.texts.cancel}' /> \
</div> \
</div> \
</div> \
</div>\
`
      return str
    }
  })
