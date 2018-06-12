import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import * as moment from 'moment';

@Component({
  selector: 'account-page',
  templateUrl: './account.component.html',
  styleUrls: ['./account.component.css']
})
export class AccountPageComponent implements OnInit, OnDestroy{
  accountId;
  block;
  mainData;
  moment = moment;
  time;

  constructor(private route: ActivatedRoute, protected http: HttpClient){}

  getBlockData(accountId){
  		this.http.get(`/api/v1/get_account/${accountId}`)
  				 .subscribe(
                      (res: any) => {
                          this.mainData = res;
                          this.time = this.moment(this.mainData.created).format('MMMM Do YYYY, h:mm:ss a');
                      },
                      (error) => {
                          console.error(error);
                      });
  };

  ngOnInit() {
    this.block = this.route.params.subscribe(params => {
       this.accountId = params['id'];
       this.getBlockData(this.accountId);
    });
  }

  ngOnDestroy() {
    this.block.unsubscribe(); 
  }	
}