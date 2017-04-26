$(document).ready(function() {
    $('#top_posts_view').hide()


    function plot_graph() {

        var posts_view = {};
        var post_count = {};

        $('#posts tbody tr').each(function() {
            var columns = $(this).find("td");
            if(columns[3].innerHTML=='UnPublished')
                return;

            var date = new Date(columns[1].innerHTML);

            var month = parseInt(date.getMonth());
            var cdate = parseInt(date.getDate())+1;
            var month_year = date.getFullYear() + ',' + month;

            if (month_year in posts_view) {
                posts_view[month_year] += parseInt(columns[2].innerHTML);
                post_count[month_year] += 1;
            }
            else {
                posts_view[month_year] = parseInt(columns[2].innerHTML);
                post_count[month_year] = 1;
            }
        });
        post_view_list = [];
        post_count_list = [];
        for(var entry in posts_view){
            var parts = entry.split(',');
            var utcDate = Date.UTC(parseInt(parts[0]), parseInt(parts[1]),1);
            post_view_list.push([utcDate, posts_view[entry]/post_count[entry]]);
            post_count_list.push([utcDate, post_count[entry]]);
        }




        Highcharts.chart('graph_container', {
            chart: {
                type: 'spline'
            },
            title: {
                text: 'Post Metrics'
            },

            xAxis: {
                type: 'datetime',
                dateTimeLabelFormats: {
                    month: '%b, %Y',

                },
                title: {
                    text: 'Creation Month'
                }
            },
            yAxis: {
                title: {
                    text: ''
                },
                min: 0
            },
            tooltip: {
                headerFormat: '<b>{series.name}</b><br>',
                pointFormat: '{point.x:%b, %Y}: {point.y:.2f} '
            },

            plotOptions: {
                spline: {
                    marker: {
                        enabled: true
                    }
                }
            },

            series: [{
                name: 'Average Number of Views',
                data: post_view_list
            },  {
                name: 'Number of Posts',
                data: post_count_list
            }]
        });

    }

    function sort_arr(o1,o2) {
        if(o1[1] >o2[1])
            return -1;

        if(o1[1]< o2[1])
            return 1;
        return 0;
    }

    function find_top_posts(){
        var arr = [];
        $('#posts tbody tr').each(function() {
            var columns = $(this).find("td");
            if(columns[3].innerHTML=='UnPublished')
                return;
            var temp = [];
            temp.push(columns[0].innerHTML);
            temp.push(parseInt(columns[2].innerHTML));
            arr.push(temp);
        });
        arr.sort(sort_arr);

        var top_post_html = '<b> Top most viewed posts</b> <br/>';
        top_post_html+='<table style="width: auto;" class="table table-striped table-bordered table-condensed"  cellspacing="0"><tr><th>Post</th><th>Views</th></tr>';

        for(var i=0;i<5;i++){
            top_post_html+='<tr><td>';
            if(arr[i][0].length > 150)
                top_post_html+=arr[i][0].substring(0,150)+'</td>';
            else
                top_post_html+=arr[i][0]+'</td>';
            top_post_html+='<td>'+arr[i][1]+'</td></tr>';

        }
        top_post_html+="</table>";
        $('#top_post').html(top_post_html);
        $('#top_posts_view').slideDown(1000,function () {

        });


    }



    function get_postimpressions() {
        var count = 0;
        var max_row_count = $('#posts tbody').find("td input[name='post_id']").length;

        $('#posts tbody tr').each(function() {
            var post_id_val = $(this).find("td input[name='post_id']").val();
            if(post_id_val == undefined)
                return;
            var columns = $(this).find("td");

            $.ajax({
                  url: "/page-insights/get-post-impressions/",
                  type: "get", //send it through get method
                  data: {
                    post_id:post_id_val,
                  },
                  success: function(response) {
                      columns[2].innerHTML = response.impressions;
                      count++;
                      if(count == max_row_count){
                          find_top_posts();
                          plot_graph();
                      }

                  },
                  error: function(xhr) {
                    console.log("error");
                  }
            });
        });
    }

    var dataTable =   $("#posts").dataTable({
        "bInfo": false,
        "bScrollInfinite": true,
        "bScrollCollapse": true,
        "sScrollY": "300px",
        "bProcessing": true,
        "bServerSide": true,
        "sAjaxSource": "/page-insights/get-page-posts/",
        "bFilter": false,
        "bSort": false,
        "fnServerParams": function ( aoData ) {
            aoData.push( { "name": "page_id", "value":  $('#page-id').val() } );
            aoData.push( { "name": "next_url", "value": $('#next_url').val() } );
            aoData.push( { "name": "unpublished_next_url", "value": $('#unpublished_url').val() } );
            aoData.push( { "name": "skip_unpublished", "value": $('#skip_unpublished').val() } );

        },
        "fnServerData": function ( sSource, aoData, fnCallback, oSettings ) {
            $.getJSON( sSource, aoData, function (json) {

                //set value of hidden field
                $('#next_url').val(json.next);
                $('#unpublished_url').val(json.unpublished_next);
                $('#skip_unpublished').val(json.skip_unpublished);

                fnCallback(json);
                get_postimpressions();

            } );
        }
        });
});